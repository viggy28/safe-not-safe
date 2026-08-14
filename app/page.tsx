"use client";

import { useEffect, useMemo, useState } from "react";
import type { Analysis, MigrationContext, TableSize, Verdict } from "@/src/analysis/types";
import { analyzeMigrationFromText } from "@/src/analysis/analyzeMigration";
import { safeSample, unsafeSample } from "@/src/examples/examples";
import { analyzeMigrationInWorker } from "@/src/parser/parserClient";

const verdictLabel: Record<Verdict, string> = {
  SAFE: "SAFE",
  NOT_SAFE: "NOT SAFE",
  NEEDS_CONTEXT: "NEEDS CONTEXT",
  UNSUPPORTED: "PARSE ERROR",
};

const tableSizeLabels: Record<TableSize, string> = {
  small: "Under 50k",
  medium: "50k to 5M",
  large: "Over 5M",
};

function verdictClass(verdict: Verdict) {
  return `verdict-${verdict.toLowerCase().replace("_", "-")}`;
}

export default function Home() {
  const [sql, setSql] = useState(safeSample);
  const [tableSize, setTableSize] = useState<TableSize | undefined>();
  const [wrapsInTransaction, setWrapsInTransaction] = useState(false);
  const context: MigrationContext = useMemo(
    () => ({ tableSize, wrapsInTransaction }),
    [tableSize, wrapsInTransaction],
  );
  const [analysis, setAnalysis] = useState<Analysis>(() => analyzeMigrationFromText(safeSample, context));
  const [parserState, setParserState] = useState<"ready" | "analyzing" | "fallback">("fallback");
  const diffLines = sql.split("\n");

  useEffect(() => {
    const fallback = analyzeMigrationFromText(sql, context);
    /* eslint-disable react-hooks/set-state-in-effect */
    setAnalysis(fallback);
    setParserState("analyzing");
    /* eslint-enable react-hooks/set-state-in-effect */

    const timeout = window.setTimeout(() => {
      analyzeMigrationInWorker(sql, context)
        .then((result) => {
          setAnalysis(result);
          setParserState("ready");
        })
        .catch(() => {
          setAnalysis(fallback);
          setParserState("fallback");
        });
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [sql, context]);

  function setSample(nextSql: string) {
    setSql(nextSql);
    setTableSize(undefined);
    setWrapsInTransaction(false);
  }

  return (
    <main className="pr-root">
      <header className="pr-topbar">
        <strong>safe-not-safe</strong>
        <span>pull request review</span>
        <span>runs locally in browser</span>
      </header>

      <section className="pr-heading">
        <div>
          <p>viggy28 wants to merge 1 migration into prod</p>
          <h1>Add migration safety check before deploy</h1>
        </div>
        <aside className={`pr-check ${verdictClass(analysis.verdict)}`}>
          <span>safe-not-safe/check</span>
          <strong>{verdictLabel[analysis.verdict]}</strong>
        </aside>
      </section>

      <section className="pr-toolbar" aria-label="Migration context">
        <button type="button" onClick={() => setSample(safeSample)}>
          safe sample
        </button>
        <button type="button" onClick={() => setSample(unsafeSample)}>
          risky sample
        </button>
        <button type="button" onClick={() => setSample("")}>
          clear
        </button>
        {(Object.keys(tableSizeLabels) as TableSize[]).map((size) => (
          <button
            key={size}
            type="button"
            className={tableSize === size ? "selected" : undefined}
            onClick={() => setTableSize((current) => (current === size ? undefined : size))}
          >
            {tableSizeLabels[size]}
          </button>
        ))}
        <label>
          <input
            type="checkbox"
            checked={wrapsInTransaction}
            onChange={(event) => setWrapsInTransaction(event.target.checked)}
          />
          wraps transaction
        </label>
      </section>

      <section className="pr-layout">
        <section className="pr-file" aria-label="Migration diff">
          <div className="pr-file-header">
            <span>db/migrations/20260814_safe_not_safe.sql</span>
            <span>{diffLines.length} lines changed</span>
          </div>
          <div className="pr-diff-shell">
            <div className="diff-lines" aria-hidden="true">
              {diffLines.map((_, index) => (
                <span key={index}>{index + 1}</span>
              ))}
            </div>
            <textarea
              aria-label="Paste Postgres migration"
              spellCheck={false}
              value={sql}
              onChange={(event) => {
                setSql(event.target.value);
                setTableSize(undefined);
              }}
            />
          </div>
        </section>

        <aside className="pr-review" aria-label="Migration verdict details">
          <div className="pr-review-summary">
            <span>{analysis.parser === "libpg_query" ? "libpg_query.wasm" : "fallback"} / {parserState}</span>
            <h2>{analysis.headline}</h2>
            <p>{analysis.question?.reason ?? analysis.summary}</p>
          </div>
          <div className="pr-comments">
            {analysis.findings.length ? (
              analysis.findings.slice(0, 5).map((finding) => (
                <article key={finding.id} className={`pr-comment finding-${finding.severity}`}>
                  <header>
                    <strong>safe-not-safe bot</strong>
                    <span>{finding.severity === "unsafe" ? "requested changes" : finding.severity === "context" ? "question" : "commented"}</span>
                  </header>
                  <h3>{finding.title}</h3>
                  <p>{finding.why}</p>
                  <code>{finding.statement}</code>
                </article>
              ))
            ) : (
              <p className="pr-empty">No comments yet. Paste a migration to start review.</p>
            )}
          </div>
          <footer>
            No SQL uploaded. No backend. Analysis happens in a browser worker.
          </footer>
        </aside>
      </section>
    </main>
  );
}
