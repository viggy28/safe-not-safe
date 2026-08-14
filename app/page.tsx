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
  const tableFlag = tableSize ? ` --table=${tableSize}` : "";
  const transactionFlag = wrapsInTransaction ? " --transaction" : "";

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
    <main className="shell-root">
      <section className="shell-window" aria-label="Safe Not Safe terminal UI">
        <div className="shell-titlebar">
          <span>safe-not-safe@browser:~/prod</span>
          <span>{analysis.parser === "libpg_query" ? "wasm parser" : "fallback parser"}</span>
        </div>
        <div className="shell-log" aria-label="Privacy trace">
          <span>$ safe-not-safe check --stdin --local --no-network{tableFlag}{transactionFlag}</span>
          <span>parser={analysis.parser === "libpg_query" ? "libpg_query.wasm" : "fast-fallback"} worker={parserState}</span>
        </div>
        <div className="shell-body">
          <section className="shell-stdin" aria-label="Migration input">
            <div className="shell-pane-head">
              <span>stdin: paste postgres migration, then read stdout</span>
              <span>{sql.length.toLocaleString()} bytes</span>
            </div>
            <div className="stdin-marker">
              <span>{"cat <<'SQL' | safe-not-safe check"}</span>
              <span>SQL stays in this tab</span>
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
            <pre className="stdout">
{`safe-not-safe/check
verdict: ${verdictLabel[analysis.verdict]}
headline: ${analysis.headline}
summary: ${analysis.summary}

runtime:
  network: none
  parser: ${analysis.parser === "libpg_query" ? "libpg_query.wasm" : "fast fallback"}
  thread: browser worker

findings:`}
            </pre>
            <div className="shell-status-grid">
              <span>statements</span>
              <strong>{analysis.findings.length}</strong>
              <span>result</span>
              <strong>{verdictLabel[analysis.verdict]}</strong>
              <span>primary</span>
              <strong>{decisiveFinding?.title ?? "waiting for sql"}</strong>
            </div>
            <div className="shell-findings">
              {analysis.findings.slice(0, 4).map((finding) => (
                <article key={finding.id}>
                  <span className={`finding-${finding.severity}`}>
                    {finding.severity === "unsafe" ? "err" : finding.severity === "context" ? "ask" : "ok"}
                  </span>
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
