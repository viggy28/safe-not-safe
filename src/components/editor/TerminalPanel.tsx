"use client";

import type { Analysis, Finding } from "@/src/analysis/types";
import { rules } from "@/src/rules";
import { severityMeta, type VerdictMeta } from "@/src/ui/verdictMeta";
import type { PanelTab } from "@/src/ui/types";
import type { ParserState } from "@/src/parser/parserClient";
import { AstBody, AstTypeName } from "@/src/components/editor/AstView";

const TABS: Array<{ key: PanelTab; label: string }> = [
  { key: "problems", label: "PROBLEMS" },
  { key: "terminal", label: "TERMINAL" },
  { key: "output", label: "OUTPUT" },
  { key: "ast", label: "PARSE TREE" },
  { key: "rules", label: "RULE ENGINE" },
];

// `analyzeParsedMigration` reports the concurrent-in-transaction case under a
// distinct id; fold it back onto the rule that produced it for the catalog.
const RULE_ALIASES: Record<string, string> = {
  "concurrently-inside-transaction": "create-index-concurrently",
};

function catalogRuleId(finding: Finding) {
  return RULE_ALIASES[finding.ruleId] ?? finding.ruleId;
}

type TerminalPanelProps = {
  panelTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  analysis: Analysis;
  verdict: VerdictMeta;
  parserState: ParserState;
  activeName: string;
  charCount: number;
  onRetryParser: () => void;
};

export function TerminalPanel({
  panelTab,
  onTabChange,
  analysis,
  verdict,
  parserState,
  activeName,
  charCount,
  onRetryParser,
}: TerminalPanelProps) {
  const findings = analysis.findings;
  const statements = analysis.statements;
  const problemCount = findings.filter((finding) => finding.severity !== "safe").length;

  const ruleRows = rules.map((rule, index) => {
    const hits = findings.filter((finding) => catalogRuleId(finding) === rule.id);
    const worst =
      hits.find((finding) => finding.severity === "unsafe") ||
      hits.find((finding) => finding.severity === "context") ||
      hits.find((finding) => finding.severity === "unsupported") ||
      hits[0];

    return {
      id: rule.id,
      order: String(index + 1).padStart(2, "0"),
      checks: rule.checks,
      matched: hits.length,
      state: hits.length ? `matched × ${hits.length}` : "not reached",
      lines: hits.length ? hits.map((finding) => `Ln ${finding.line ?? "?"}`).join(", ") : "—",
      color: worst ? severityMeta[worst.severity].dark : "#4d5b73",
    };
  });

  const matchedRuleCount = ruleRows.filter((row) => row.matched).length;

  const parseLabel =
    parserState === "ready"
      ? "libpg_query 17 (wasm)"
      : parserState === "analyzing"
        ? "libpg_query 17 (wasm) · analyzing"
        : parserState === "initializing"
          ? "libpg_query 17 (wasm) · initializing"
          : "libpg_query 17 (wasm) · unavailable";

  return (
    <div className="terminal-panel">
      <div className="terminal-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`terminal-tab${panelTab === tab.key ? " is-active" : ""}`}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
        <span className="terminal-tabs-spacer" />
        <span className="terminal-tab-actions">
          <span>bash</span>
          <span>+</span>
          <span>⌃`</span>
        </span>
      </div>

      <div className="terminal-body">
        {panelTab === "terminal" ? (
          <TerminalView
            findings={findings}
            verdict={verdict}
            analysis={analysis}
            parserState={parserState}
            parseLabel={parseLabel}
            activeName={activeName}
            charCount={charCount}
            statementCount={statements.length}
            onRetryParser={onRetryParser}
          />
        ) : null}

        {panelTab === "problems" ? (
          <ProblemsView findings={findings} problemCount={problemCount} activeName={activeName} />
        ) : null}

        {panelTab === "output" ? (
          <OutputView
            parserState={parserState}
            statementCount={statements.length}
            matchedRuleCount={matchedRuleCount}
            verdict={verdict}
            onRetryParser={onRetryParser}
          />
        ) : null}

        {panelTab === "ast" ? (
          <AstView findings={findings} statements={statements} />
        ) : null}

        {panelTab === "rules" ? (
          <RulesView ruleRows={ruleRows} />
        ) : null}
      </div>
    </div>
  );
}

function TerminalView({
  findings,
  verdict,
  analysis,
  parserState,
  parseLabel,
  activeName,
  charCount,
  statementCount,
  onRetryParser,
}: {
  findings: Finding[];
  verdict: VerdictMeta;
  analysis: Analysis;
  parserState: ParserState;
  parseLabel: string;
  activeName: string;
  charCount: number;
  statementCount: number;
  onRetryParser: () => void;
}) {
  const decisive = analysis.decisiveFinding;

  return (
    <div className="terminal-view">
      <div className="term-command">$ npx safe-not-safe check {activeName}</div>
      <div className="term-parse">
        <span className="term-accent">parse</span>
        <span className="term-dim">  {parseLabel} · {statementCount} statements · {charCount.toLocaleString()} chars</span>
      </div>

      {parserState === "initializing" ? (
        <div className="term-note">note  Downloading and compiling the PostgreSQL WASM parser.</div>
      ) : null}
      {parserState === "analyzing" ? (
        <div className="term-note">note  The PostgreSQL parser is checking the latest SQL.</div>
      ) : null}
      {parserState === "error" ? (
        <div className="term-note">
          The PostgreSQL parser is unavailable. No safety verdict was issued.{" "}
          <button type="button" className="term-retry" onClick={onRetryParser}>Retry</button>
        </div>
      ) : null}

      {findings.length ? (
        <div className="term-findings">
          {findings.map((finding) => {
            const severity = severityMeta[finding.severity];
            return (
              <div key={finding.id} className="term-finding">
                <div className="term-finding-head">
                  <span className="term-muted">[Ln {finding.line ?? "?"}]</span>{" "}
                  <span className="term-tag" style={{ color: severity.dark }}>
                    {severity.tag}
                  </span>{" "}
                  <span className="term-text">{finding.title}</span>{" "}
                  <span className="term-faint">({finding.ruleId})</span>
                </div>
                <div className="term-finding-why">{finding.why}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="term-note">No statements found. Paste a migration or load a sample.</div>
      )}

      <div className="term-verdict">
        <div>
          <span className="term-tag" style={{ color: verdict.dark }}>
            {verdict.label}
          </span>{" "}
          <span className="term-text">— {analysis.headline}</span>
        </div>
        <div className="term-finding-why">{analysis.summary}</div>
      </div>

      {decisive?.fix ? (
        <>
          <div className="term-command">$ safe-not-safe suggest --statement 1</div>
          <pre className="term-fix">{decisive.fix}</pre>
        </>
      ) : null}

      <div className="term-command">
        $ <span className="term-cursor" />
      </div>
    </div>
  );
}

function ProblemsView({
  findings,
  problemCount,
  activeName,
}: {
  findings: Finding[];
  problemCount: number;
  activeName: string;
}) {
  return (
    <div className="problems-view">
      <div className="term-muted">
        {problemCount} problems · {findings.length} statements checked in {activeName}
      </div>
      <div className="problems-list">
        {findings.length ? (
          findings.map((finding) => {
            const severity = severityMeta[finding.severity];
            return (
              <div key={finding.id} className="problem-row">
                <span className="problem-glyph" style={{ color: severity.dark }}>
                  {severity.glyph}
                </span>
                <div className="problem-body">
                  <div className="problem-title">
                    <span className="term-text">{finding.title}</span>{" "}
                    <span className="term-muted">
                      [Ln {finding.line ?? "?"}] safe-not-safe({severity.tag})
                    </span>
                  </div>
                  <div className="term-dim">{finding.why}</div>
                  <div className="problem-statement">{finding.statement}</div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="term-note">No findings yet.</div>
        )}
      </div>
    </div>
  );
}

function OutputView({
  parserState,
  statementCount,
  matchedRuleCount,
  verdict,
  onRetryParser,
}: {
  parserState: ParserState;
  statementCount: number;
  matchedRuleCount: number;
  verdict: VerdictMeta;
  onRetryParser: () => void;
}) {
  const workerLine =
    parserState === "ready"
      ? "libpg_query wasm ready"
      : parserState === "analyzing"
        ? "libpg_query wasm ready · analyzing latest SQL"
        : parserState === "initializing"
          ? "libpg_query wasm loading…"
          : "libpg_query wasm unavailable";

  return (
    <div className="output-view">
      <div>
        <span className="term-muted">[worker]</span> <span className="term-dim">{workerLine}</span>
      </div>
      <div>
        <span className="term-muted">[parse]</span>{" "}
        <span className="term-dim">{statementCount} statements normalized</span>
      </div>
      <div>
        <span className="term-muted">[rules]</span>{" "}
        <span className="term-dim">
          {matchedRuleCount} of {rules.length} rules matched, ordered catalog, first match wins
        </span>
      </div>
      <div>
        <span className="term-muted">[verdict]</span>{" "}
        <span className="term-tag" style={{ color: verdict.dark }}>
          {verdict.label}
        </span>
      </div>
      <div>
        <span className="term-muted">[network]</span> <span className="term-dim">0 SQL uploads</span>
      </div>
      {parserState === "error" ? (
        <button type="button" className="term-retry" onClick={onRetryParser}>Retry parser</button>
      ) : null}
    </div>
  );
}

function AstView({
  findings,
  statements,
}: {
  findings: Finding[];
  statements: Analysis["statements"];
}) {
  if (!statements.length) {
    return <div className="term-note">No parse tree yet.</div>;
  }

  return (
    <div className="ast-view">
      {statements.map((statement, index) => {
        const severity = severityMeta[findings[index]?.severity ?? "safe"];
        return (
          <div key={statement.id} className="ast-statement">
            <div className="ast-statement-head">
              <span className="term-muted">[{index}]</span>
              <span className="ast-node-name">
                <AstTypeName ast={statement.ast} />
              </span>
              <span className="ast-severity" style={{ color: severity.dark }}>
                {severity.tag}
              </span>
            </div>
            {statement.ast ? (
              <AstBody ast={statement.ast} />
            ) : (
              <div className="term-note">Parse tree unavailable for this statement.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RulesView({
  ruleRows,
}: {
  ruleRows: Array<{
    id: string;
    order: string;
    checks: string;
    matched: number;
    state: string;
    lines: string;
    color: string;
  }>;
}) {
  return (
    <div className="rules-view">
      <div className="term-muted">
        ordered catalog · {ruleRows.length} rules · first match per statement wins, later rules never run
      </div>
      <div className="rules-table">
        <div className="rules-table-head">
          <span className="rules-col-num">#</span>
          <span className="rules-col-rule">RULE</span>
          <span className="rules-col-checks">CHECKS</span>
          <span className="rules-col-state">STATE</span>
          <span className="rules-col-at">AT</span>
        </div>
        {ruleRows.map((row) => (
          <div key={row.id} className="rules-table-row">
            <span className="rules-col-num">{row.order}</span>
            <span
              className="rules-col-rule"
              style={{ color: row.matched ? "#dce7f7" : "#68758b" }}
            >
              {row.id}
            </span>
            <span
              className="rules-col-checks"
              style={{ color: row.matched ? "#9aa7bb" : "#4d5b73" }}
            >
              {row.checks}
            </span>
            <span className="rules-col-state" style={{ color: row.color }}>
              {row.state}
            </span>
            <span className="rules-col-at">{row.lines}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
