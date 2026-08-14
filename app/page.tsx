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
    <main className="tui-root">
      <section className="tui-frame" aria-label="Safe Not Safe TUI">
        <header className="tui-menu">
          <strong>safe-not-safe</strong>
          <span>F1 help</span>
          <span>F2 examples</span>
          <span>F5 analyze</span>
          <span>ESC clear</span>
          <em>{analysis.parser === "libpg_query" ? "libpg_query.wasm" : "fallback"} / {parserState}</em>
        </header>

        <section className={`tui-verdict ${verdictClass(analysis.verdict)}`}>
          <div>
            <span>VERDICT</span>
            <strong>{verdictLabel[analysis.verdict]}</strong>
          </div>
          <p>{analysis.headline}</p>
        </section>

        <section className="tui-board">
          <section className="tui-box tui-input" aria-label="Migration input">
            <div className="tui-box-title">
              <span>migration.sql</span>
              <span>{sql.length.toLocaleString()} chars</span>
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

          <section className="tui-box tui-findings" aria-label="Migration verdict details">
            <div className="tui-box-title">
              <span>findings</span>
              <span>{analysis.findings.length} rows</span>
            </div>
            <div className="tui-primary">
              <strong>{decisiveFinding?.title ?? "Ready for SQL"}</strong>
              <p>{analysis.question?.reason ?? decisiveFinding?.why ?? "Paste SQL and the verdict appears here."}</p>
            </div>
            <div className="tui-table">
              {analysis.findings.length ? (
                analysis.findings.map((finding, index) => (
                  <article key={finding.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <span>{finding.severity === "unsafe" ? "FAIL" : finding.severity === "context" ? "ASK" : "PASS"}</span>
                    <strong>{finding.title}</strong>
                    <code>{finding.statement}</code>
                  </article>
                ))
              ) : (
                <p>no rows; awaiting stdin</p>
              )}
            </div>
          </section>
        </section>

        <footer className="tui-footer" aria-label="Migration context">
          <button type="button" onClick={() => setSample(safeSample)}>
            safe
          </button>
          <button type="button" onClick={() => setSample(unsafeSample)}>
            risky
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
              {size}
            </button>
          ))}
          <label>
            <input
              type="checkbox"
              checked={wrapsInTransaction}
              onChange={(event) => setWrapsInTransaction(event.target.checked)}
            />
            migration wraps tx
          </label>
          <span>local wasm parse; no upload</span>
        </footer>
      </section>
    </main>
  );
}
