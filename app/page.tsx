"use client";

import { useMemo, useState } from "react";

type Verdict = "SAFE" | "NOT SAFE";
type SizeAnswer = "small" | "medium" | "large";

type Finding = {
  id: string;
  title: string;
  statement: string;
  severity: "safe" | "unsafe" | "question";
  why: string;
  fix?: string;
  question?: {
    table: string;
    reason: string;
  };
};

type Analysis = {
  verdict: Verdict;
  headline: string;
  findings: Finding[];
  question?: Finding["question"];
  decisiveFinding?: Finding;
};

const sampleMigration = `ALTER TABLE users ADD COLUMN last_seen_at timestamptz DEFAULT now();

CREATE INDEX users_email_idx ON users (email);

ALTER TABLE orders
  ADD CONSTRAINT orders_user_id_fk
  FOREIGN KEY (user_id) REFERENCES users(id);`;

const defaultSql = `ALTER TABLE users ADD COLUMN status text DEFAULT 'active';

CREATE INDEX CONCURRENTLY users_created_at_idx
  ON users (created_at);`;

function splitStatements(sql: string) {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function compact(statement: string) {
  return statement.replace(/\s+/g, " ").trim();
}

function tableFromAlter(statement: string) {
  return statement.match(/alter\s+table\s+(?:if\s+exists\s+)?("?[\w.]"?|\w+(?:\.\w+)?)/i)?.[1] ?? "this table";
}

function indexName(statement: string) {
  return statement.match(/create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?("?[\w_]+"?)/i)?.[1] ?? "the index";
}

function analyzeStatement(statement: string, sizeAnswer?: SizeAnswer): Finding {
  const text = compact(statement);
  const lower = text.toLowerCase();
  const table = tableFromAlter(text);

  if (/^begin\b|^start\s+transaction\b/i.test(lower) || /^commit\b/i.test(lower)) {
    return {
      id: `txn-${text}`,
      title: "Transaction boundary",
      statement: text,
      severity: "safe",
      why: "The boundary itself is fine, but it changes whether some DDL can run safely.",
    };
  }

  if (/create\s+(unique\s+)?index\b/i.test(lower) && !/create\s+(unique\s+)?index\s+concurrently\b/i.test(lower)) {
    return {
      id: `index-${text}`,
      title: "Blocking index build",
      statement: text,
      severity: "unsafe",
      why: "A regular CREATE INDEX takes a lock that blocks writes while Postgres builds the index.",
      fix: text.replace(/create\s+(unique\s+)?index\b/i, (match) => `${match} CONCURRENTLY`),
    };
  }

  if (/create\s+(unique\s+)?index\s+concurrently\b/i.test(lower)) {
    return {
      id: `index-concurrently-${text}`,
      title: "Concurrent index build",
      statement: text,
      severity: "safe",
      why: `${indexName(text)} is built without blocking ordinary writes.`,
    };
  }

  if (/alter\s+table\b/i.test(lower) && /add\s+column\b/i.test(lower) && /default\s+(now|random|gen_random_uuid)\s*\(/i.test(lower)) {
    return {
      id: `volatile-default-${text}`,
      title: "Volatile column default",
      statement: text,
      severity: "unsafe",
      why: `Postgres must compute the default for every existing row in ${table}, which can rewrite the table while holding a strong lock.`,
      fix: `ALTER TABLE ${table} ADD COLUMN ...;\nALTER TABLE ${table} ALTER COLUMN ... SET DEFAULT ...;\n-- Backfill in batches before depending on the value.`,
    };
  }

  if (/alter\s+table\b/i.test(lower) && /add\s+column\b/i.test(lower) && /default\b/i.test(lower)) {
    return {
      id: `constant-default-${text}`,
      title: "Constant column default",
      statement: text,
      severity: "safe",
      why: "Constant defaults are metadata-only on modern Postgres versions, so they do not rewrite existing rows.",
    };
  }

  if (/alter\s+table\b/i.test(lower) && /alter\s+column\b/i.test(lower) && /type\b/i.test(lower)) {
    if (!sizeAnswer) {
      return {
        id: `alter-type-${text}`,
        title: "Column type rewrite depends on table size",
        statement: text,
        severity: "question",
        why: `Changing a column type can rewrite every row in ${table}.`,
        question: {
          table,
          reason: "this depended on size because ALTER COLUMN TYPE can rewrite every row while holding ACCESS EXCLUSIVE",
        },
      };
    }

    return {
      id: `alter-type-${text}`,
      title: sizeAnswer === "small" ? "Small table rewrite" : "Large table rewrite",
      statement: text,
      severity: sizeAnswer === "small" ? "safe" : "unsafe",
      why:
        sizeAnswer === "small"
          ? `${table} is small enough that a rewrite is unlikely to create meaningful downtime.`
          : `${table} is large enough that rewriting it under ACCESS EXCLUSIVE can become downtime.`,
      fix:
        sizeAnswer === "small"
          ? undefined
          : `Create a new column, backfill in batches, dual-write during deploy, then swap names in a short final migration.`,
    };
  }

  if (/alter\s+table\b/i.test(lower) && /add\s+constraint\b/i.test(lower) && /foreign\s+key\b/i.test(lower) && !/not\s+valid\b/i.test(lower)) {
    if (!sizeAnswer) {
      return {
        id: `fk-validating-${text}`,
        title: "Foreign key validation depends on table size",
        statement: text,
        severity: "question",
        why: `Adding a validating foreign key scans ${table} and takes locks on both tables.`,
        question: {
          table,
          reason: "this depended on size because validating a new foreign key scans existing rows and locks both sides",
        },
      };
    }

    return {
      id: `fk-validating-${text}`,
      title: sizeAnswer === "small" ? "Small validating foreign key" : "Validating foreign key",
      statement: text,
      severity: sizeAnswer === "small" ? "safe" : "unsafe",
      why:
        sizeAnswer === "small"
          ? `${table} is small, so validating existing rows should finish quickly.`
          : `On a busy or large ${table}, the validation scan can block writes longer than you want.`,
      fix: `ALTER TABLE ${table} ADD CONSTRAINT ... FOREIGN KEY (...) REFERENCES ... NOT VALID;\nALTER TABLE ${table} VALIDATE CONSTRAINT ...;`,
    };
  }

  if (/alter\s+table\b/i.test(lower) && /validate\s+constraint\b/i.test(lower)) {
    return {
      id: `validate-constraint-${text}`,
      title: "Constraint validation",
      statement: text,
      severity: "safe",
      why: "VALIDATE CONSTRAINT is designed for the second step of the safer foreign-key rollout.",
    };
  }

  if (/alter\s+table\b/i.test(lower) && /set\s+not\s+null\b/i.test(lower)) {
    return {
      id: `not-null-${text}`,
      title: "NOT NULL validation",
      statement: text,
      severity: "unsafe",
      why: `SET NOT NULL can scan ${table} while holding a lock unless a matching validated CHECK already proves the column is filled.`,
      fix: `ALTER TABLE ${table} ADD CONSTRAINT ... CHECK (... IS NOT NULL) NOT VALID;\nALTER TABLE ${table} VALIDATE CONSTRAINT ...;\nALTER TABLE ${table} ALTER COLUMN ... SET NOT NULL;`,
    };
  }

  if (/alter\s+table\b/i.test(lower) && /drop\s+column\b/i.test(lower)) {
    return {
      id: `drop-column-${text}`,
      title: "Column drop",
      statement: text,
      severity: "unsafe",
      why: `DROP COLUMN takes ACCESS EXCLUSIVE on ${table} and can break old application code still reading the column.`,
      fix: "Stop reads and writes first, deploy that code, then drop the column in a later migration.",
    };
  }

  if (/^\s*truncate\b/i.test(lower)) {
    return {
      id: `truncate-${text}`,
      title: "TRUNCATE",
      statement: text,
      severity: "unsafe",
      why: "TRUNCATE takes ACCESS EXCLUSIVE and is rarely a safe online migration.",
      fix: "Delete in batches, or run the operation during a deliberate maintenance window.",
    };
  }

  if (/alter\s+table\b/i.test(lower) && /rename\s+(column|to)\b/i.test(lower)) {
    return {
      id: `rename-${text}`,
      title: "Rename",
      statement: text,
      severity: "unsafe",
      why: "Renames are fast but not backward-compatible with old application code or long-running deploys.",
      fix: "Add the new name, dual-write or keep compatibility code, deploy, then remove the old name later.",
    };
  }

  if (/alter\s+table\b/i.test(lower) && /add\s+constraint\b/i.test(lower) && /unique\b/i.test(lower)) {
    return {
      id: `unique-${text}`,
      title: "Unique constraint build",
      statement: text,
      severity: "unsafe",
      why: "Adding a UNIQUE constraint directly builds the backing index while holding stronger locks than necessary.",
      fix: `CREATE UNIQUE INDEX CONCURRENTLY ...;\nALTER TABLE ${table} ADD CONSTRAINT ... UNIQUE USING INDEX ...;`,
    };
  }

  if (/^\s*(cluster|vacuum\s+full)\b/i.test(lower)) {
    return {
      id: `rewrite-command-${text}`,
      title: "Table rewrite command",
      statement: text,
      severity: "unsafe",
      why: "This rewrites table storage and takes locks that do not belong in a normal online migration.",
      fix: "Use an online migration strategy or run during a planned maintenance window.",
    };
  }

  return {
    id: `safe-${text}`,
    title: "No high-risk pattern matched",
    statement: text,
    severity: "safe",
    why: "This prototype did not find one of the common blocking or rewrite patterns in this statement.",
  };
}

function analyzeMigration(sql: string, sizeAnswer?: SizeAnswer): Analysis {
  const statements = splitStatements(sql);
  if (!statements.length) {
    return {
      verdict: "SAFE",
      headline: "Paste a migration to get a verdict.",
      findings: [],
    };
  }

  const hasTransaction = statements.some((statement) => /^\s*(begin|start\s+transaction)\b/i.test(statement));
  const findings = statements.map((statement) => analyzeStatement(statement, sizeAnswer));

  if (hasTransaction) {
    for (const statement of statements) {
      if (/create\s+(unique\s+)?index\s+concurrently\b/i.test(statement)) {
        findings.push({
          id: `concurrent-in-txn-${statement}`,
          title: "CONCURRENTLY inside a transaction",
          statement: compact(statement),
          severity: "unsafe",
          why: "Postgres rejects CREATE INDEX CONCURRENTLY inside a transaction block.",
          fix: "Run the concurrent index statement outside BEGIN / COMMIT.",
        });
      }
    }
  }

  const unsafe = findings.find((finding) => finding.severity === "unsafe");
  if (unsafe) {
    return {
      verdict: "NOT SAFE",
      headline: unsafe.title,
      findings,
      decisiveFinding: unsafe,
    };
  }

  const questionFinding = findings.find((finding) => finding.severity === "question" && finding.question);
  if (questionFinding?.question) {
    return {
      verdict: "NOT SAFE",
      headline: "One thing decides this migration.",
      findings,
      question: questionFinding.question,
      decisiveFinding: questionFinding,
    };
  }

  return {
    verdict: "SAFE",
    headline: "No blocking pattern found.",
    findings,
  };
}

export default function Home() {
  const [sql, setSql] = useState(defaultSql);
  const [sizeAnswer, setSizeAnswer] = useState<SizeAnswer | undefined>();
  const analysis = useMemo(() => analyzeMigration(sql, sizeAnswer), [sql, sizeAnswer]);
  const decisiveFinding = analysis.decisiveFinding ?? analysis.findings[0];

  function loadSample() {
    setSql(sampleMigration);
    setSizeAnswer(undefined);
  }

  function clearSql() {
    setSql("");
    setSizeAnswer(undefined);
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#181512]">
      <section className="app-shell">
        <div className="brand-row" aria-label="Product">
          <div className="brand-mark" aria-hidden="true">
            SQL
          </div>
          <div>
            <p className="eyebrow">Nothing leaves your browser</p>
            <h1>Is my migration safe?</h1>
          </div>
        </div>

        <div className={`verdict ${analysis.verdict === "SAFE" ? "verdict-safe" : "verdict-unsafe"}`}>
          <p>Verdict</p>
          <strong>{analysis.question ? "?" : analysis.verdict}</strong>
          <span>{analysis.headline}</span>
        </div>

        <div className="workspace-grid">
          <section className="sql-pane" aria-label="Migration input">
            <div className="pane-toolbar">
              <div>
                <span className="toolbar-label">Postgres migration</span>
                <p>Offline prototype rules engine</p>
              </div>
              <div className="toolbar-actions">
                <button type="button" onClick={loadSample}>
                  Sample
                </button>
                <button type="button" onClick={clearSql}>
                  Clear
                </button>
              </div>
            </div>
            <textarea
              aria-label="Paste Postgres migration"
              spellCheck={false}
              value={sql}
              onChange={(event) => {
                setSql(event.target.value);
                setSizeAnswer(undefined);
              }}
            />
          </section>

          <section className="result-pane" aria-label="Migration verdict details">
            {analysis.question ? (
              <div className="question-panel">
                <p className="eyebrow">One follow-up question</p>
                <h2>Roughly how big is <code>{analysis.question.table}</code>?</h2>
                <div className="choice-grid">
                  <button type="button" onClick={() => setSizeAnswer("small")}>
                    <strong>Under 50k rows</strong>
                    <span>A rewrite here is usually under a second.</span>
                  </button>
                  <button type="button" onClick={() => setSizeAnswer("medium")}>
                    <strong>50k to 5M</strong>
                    <span>Seconds to minutes of lock risk.</span>
                  </button>
                  <button type="button" onClick={() => setSizeAnswer("large")}>
                    <strong>Over 5M</strong>
                    <span>Treat a rewrite as an outage.</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="finding-lead">
                <p className="eyebrow">Why</p>
                <h2>{decisiveFinding?.title ?? "Ready for a migration"}</h2>
                <p>{decisiveFinding?.why ?? "Paste SQL and the verdict appears here."}</p>
                {decisiveFinding?.fix ? (
                  <>
                    <p className="eyebrow">Safe rewrite</p>
                    <pre>{decisiveFinding.fix}</pre>
                  </>
                ) : null}
                {sizeAnswer && analysis.verdict === "SAFE" ? (
                  <p className="lesson">Asked because {analysis.findings.find((finding) => finding.question)?.question?.reason}.</p>
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
                    <div>
                      <span>{finding.severity === "unsafe" ? "NOT SAFE" : finding.severity === "question" ? "ASK" : "SAFE"}</span>
                      <h3>{finding.title}</h3>
                    </div>
                    <code>{finding.statement}</code>
                  </article>
                ))
              ) : (
                <p className="empty-state">Awaiting SQL.</p>
              )}
            </div>
          </section>
        </div>

        <section className="rules-strip" aria-label="Rule coverage">
          <div>
            <strong>12-rule launch scope</strong>
            <span>indexes, volatile defaults, type rewrites, validating FKs, NOT NULL, drops, truncates, renames, unique constraints, heavy rewrites, transaction traps</span>
          </div>
          <div>
            <strong>Default promise</strong>
            <span>raw SQL analysis runs in-browser with no accounts, logs, database, or API call</span>
          </div>
          <div>
            <strong>Next technical step</strong>
            <span>replace the prototype matcher with libpg_query WASM and a shared rules catalog</span>
          </div>
        </section>
      </section>
    </main>
  );
}
