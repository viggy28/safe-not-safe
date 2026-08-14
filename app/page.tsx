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
    <main className="hn-root">
      <header className="hn-header">
        <a href="#checker">safe-not-safe</a>
        <span>postgres migrations</span>
        <span>local wasm</span>
        <span>not saas</span>
      </header>

      <section className="hn-intro">
        <pre aria-hidden="true">{`   _____        __
  / ___/ ____ _/ /__
  \\__ \\ / __ \`/ / _ \\
 ___/ // /_/ / /  __/
/____/ \\__,_/_/\\___/  ?`}</pre>
        <div>
          <h1>Is this migration safe?</h1>
          <p>Paste SQL. Get a verdict. Nothing leaves your browser.</p>
        </div>
      </section>

      <section id="checker" className="hn-checker">
        <div className={`hn-verdict ${verdictClass(analysis.verdict)}`}>
          <span>{verdictLabel[analysis.verdict]}</span>
          <strong>{analysis.headline}</strong>
        </div>

        <div className="hn-actions" aria-label="Migration context">
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
              {size}
            </button>
          ))}
          <label>
            <input
              type="checkbox"
              checked={wrapsInTransaction}
              onChange={(event) => setWrapsInTransaction(event.target.checked)}
            />
            wraps tx
          </label>
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

        <section className="hn-output" aria-label="Migration verdict details">
          <div>
            <h2>{decisiveFinding?.title ?? "Ready for SQL"}</h2>
            <p>{analysis.question?.reason ?? decisiveFinding?.why ?? "Paste SQL and the verdict appears here."}</p>
          </div>
          <ol>
            {analysis.findings.slice(0, 5).map((finding) => (
              <li key={finding.id}>
                <strong>{finding.severity === "unsafe" ? "not safe" : finding.severity === "context" ? "ask" : "safe"}</strong>
                <span>{finding.title}</span>
              </li>
            ))}
          </ol>
        </section>
      </section>

      <footer className="hn-footer">
        <span>privacy model:</span> local parser, browser worker, no backend, no sql logs.
      </footer>
    </main>
  );
}
