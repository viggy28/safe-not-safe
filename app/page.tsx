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
    <main className="app-root console-root">
      <section className="topbar" aria-label="Product">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            DB
          </div>
          <div>
            <p className="eyebrow">Safe / Not Safe console</p>
            <h1>A local-first migration review workspace.</h1>
          </div>
        </div>
        <div className="runtime-pill">
          <span className={`status-dot ${parserState}`} aria-hidden="true" />
          <span>{analysis.parser === "libpg_query" ? "libpg_query parser" : "fast fallback"}</span>
        </div>
      </section>

      <section className={`verdict-panel ${verdictClass(analysis.verdict)}`}>
        <div>
          <p className="eyebrow">Verdict</p>
          <strong>{verdictLabel[analysis.verdict]}</strong>
        </div>
        <div className="verdict-copy">
          <h2>{analysis.headline}</h2>
          <p>{analysis.summary}</p>
        </div>
      </section>

      <section className="control-strip" aria-label="Migration context">
        <div className="segmented-control" aria-label="Sample migrations">
          <button type="button" onClick={() => setSample(safeSample)}>
            Safe sample
          </button>
          <button type="button" onClick={() => setSample(unsafeSample)}>
            Risky sample
          </button>
          <button type="button" onClick={() => setSample("")}>
            Clear
          </button>
        </div>
        <div className="segmented-control" aria-label="Table size">
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
        </div>
        <label className="toggle-control">
          <input
            type="checkbox"
            checked={wrapsInTransaction}
            onChange={(event) => setWrapsInTransaction(event.target.checked)}
          />
          <span>Migration tool wraps transaction</span>
        </label>
      </section>

      <section className="workspace-grid">
        <section className="editor-pane" aria-label="Migration input">
          <div className="pane-header">
            <div>
              <span className="toolbar-label">Review input</span>
              <p>Paste a Postgres migration and inspect lock, rewrite, and validation risks.</p>
            </div>
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

        <section className="result-pane" aria-label="Migration verdict details">
          {analysis.question ? (
            <div className="question-panel">
              <p className="eyebrow">Context required</p>
              <h2>{analysis.question.label}</h2>
              <p>{analysis.question.reason}</p>
            </div>
          ) : (
            <div className="finding-lead">
              <p className="eyebrow">Primary finding</p>
              <h2>{decisiveFinding?.title ?? "Ready for SQL"}</h2>
              <p>{decisiveFinding?.why ?? "Paste SQL and the verdict appears here."}</p>
              {decisiveFinding?.fix ? (
                <>
                  <p className="eyebrow safe-rewrite-label">Safer rewrite</p>
                  <pre>{decisiveFinding.fix}</pre>
                </>
              ) : null}
            </div>
          )}

          <div className="findings-list">
            <div className="list-heading">
              <span>Statements checked</span>
              <strong>{analysis.findings.length}</strong>
            </div>
            {analysis.findings.length ? (
              analysis.findings.map((finding) => (
                <article key={finding.id} className={`finding finding-${finding.severity}`}>
                  <div className="finding-title-row">
                    <span>
                      {finding.severity === "unsafe"
                        ? "NOT SAFE"
                        : finding.severity === "context"
                          ? "ASK"
                          : "SAFE"}
                    </span>
                    <h3>{finding.title}</h3>
                  </div>
                  <p>{finding.why}</p>
                  <code>{finding.statement}</code>
                </article>
              ))
            ) : (
              <p className="empty-state">Awaiting SQL.</p>
            )}
          </div>
        </section>
      </section>

      <section className="architecture-strip" aria-label="Architecture">
        <div>
          <strong>1. Paste migration</strong>
          <span>Use real Postgres SQL from a migration file, deploy diff, or generated script.</span>
        </div>
        <div>
          <strong>2. Parse locally</strong>
          <span>libpg_query runs as WASM in the browser. SQL does not leave the page.</span>
        </div>
        <div>
          <strong>3. Review findings</strong>
          <span>Rules run in a Web Worker and return a verdict with safer migration notes.</span>
        </div>
      </section>
    </main>
  );
}
