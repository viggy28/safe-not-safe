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
  const decisiveFinding = analysis.decisiveFinding ?? analysis.findings[0];

  useEffect(() => {
    const fallback = analyzeMigrationFromText(sql, context);
    setAnalysis(fallback);
    setParserState("analyzing");

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
    <main className="shell-root">
      <section className="shell-window" aria-label="Safe Not Safe terminal UI">
        <div className="shell-titlebar">
          <span>safe-not-safe@browser:~/prod</span>
          <span>{analysis.parser === "libpg_query" ? "wasm parser" : "fallback parser"}</span>
        </div>
        <div className="shell-log" aria-label="Privacy trace">
          <span>$ safe-not-safe check migration.sql --local --no-network</span>
          <span>parser={analysis.parser === "libpg_query" ? "libpg_query.wasm" : "fast-fallback"} worker={parserState}</span>
        </div>
        <div className="shell-body">
          <section className="shell-editor" aria-label="Migration input">
            <div className="shell-pane-head">
              <span>vim migration.sql</span>
              <span>{sql.length.toLocaleString()} bytes</span>
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
          </section>

          <aside className={`shell-output ${verdictClass(analysis.verdict)}`} aria-label="Migration verdict details">
            <div className="shell-verdict-line">
              <span>exit</span>
              <strong>{verdictLabel[analysis.verdict]}</strong>
            </div>
            <h1>{analysis.headline}</h1>
            <p>{analysis.summary}</p>
            <div className="shell-status-grid">
              <span>network</span>
              <strong>none</strong>
              <span>runtime</span>
              <strong>browser worker</strong>
              <span>statements</span>
              <strong>{analysis.findings.length}</strong>
            </div>
            <div className="shell-findings">
              {analysis.findings.slice(0, 4).map((finding) => (
                <article key={finding.id}>
                  <span>{finding.severity === "unsafe" ? "!" : finding.severity === "context" ? "?" : "ok"}</span>
                  <div>
                    <strong>{finding.title}</strong>
                    <code>{finding.statement}</code>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </div>

        <div className="shell-actions" aria-label="Migration context">
          <button type="button" onClick={() => setSample(safeSample)}>
            :load safe
          </button>
          <button type="button" onClick={() => setSample(unsafeSample)}>
            :load risky
          </button>
          <button type="button" onClick={() => setSample("")}>
            :new
          </button>
          {(Object.keys(tableSizeLabels) as TableSize[]).map((size) => (
            <button
              key={size}
              type="button"
              className={tableSize === size ? "selected" : undefined}
              onClick={() => setTableSize((current) => (current === size ? undefined : size))}
            >
              --table={size}
            </button>
          ))}
          <label>
            <input
              type="checkbox"
              checked={wrapsInTransaction}
              onChange={(event) => setWrapsInTransaction(event.target.checked)}
            />
            --transaction
          </label>
        </div>
      </section>
    </main>
  );
}
