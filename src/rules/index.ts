import type { Finding, MigrationContext, ParsedMigration, ParsedStatement, Rule } from "@/src/analysis/types";

function hasAction(statement: ParsedStatement, action: ParsedStatement["alterActions"][number]) {
  return statement.alterActions.includes(action);
}

function tableName(statement: ParsedStatement) {
  return statement.tableName ?? "this table";
}

function hasTransaction(migration: ParsedMigration, context: MigrationContext) {
  return context.wrapsInTransaction || migration.statements.some((statement) => statement.kind === "transaction");
}

function finding(
  statement: ParsedStatement,
  ruleId: string,
  title: string,
  severity: Finding["severity"],
  why: string,
  fix?: string,
): Finding {
  return {
    id: `${ruleId}-${statement.id}`,
    ruleId,
    title,
    statement: statement.compactSql,
    severity,
    why,
    fix,
    line: statement.line,
  };
}

export const rules: Rule[] = [
  {
    id: "transaction-boundary",
    checks: "BEGIN / COMMIT changes what may run concurrently",
    evaluate(statement) {
      if (statement.kind !== "transaction") {
        return null;
      }

      return finding(
        statement,
        this.id,
        "Transaction boundary",
        "safe",
        "The boundary itself is fine, but it changes whether concurrent index builds can run.",
      );
    },
  },
  {
    id: "create-index-without-concurrently",
    checks: "CREATE INDEX without CONCURRENTLY blocks writes",
    evaluate(statement) {
      if (statement.kind !== "create_index" || statement.indexConcurrent) {
        return null;
      }

      return finding(
        statement,
        this.id,
        "Blocking index build",
        "unsafe",
        "A regular CREATE INDEX blocks writes while Postgres builds the index.",
        statement.compactSql.replace(/create\s+(unique\s+)?index\b/i, (match) => `${match} CONCURRENTLY`),
      );
    },
  },
  {
    id: "create-index-concurrently",
    checks: "CREATE INDEX CONCURRENTLY, rejected inside a transaction",
    evaluate(statement, migration, context) {
      if (statement.kind !== "create_index" || !statement.indexConcurrent) {
        return null;
      }

      if (hasTransaction(migration, context)) {
        return finding(
          statement,
          "concurrently-inside-transaction",
          "CONCURRENTLY inside a transaction",
          "unsafe",
          "Postgres rejects CREATE INDEX CONCURRENTLY inside an explicit transaction block or transaction-wrapped migration.",
          "Run the concurrent index statement outside BEGIN / COMMIT and outside migration tools that wrap DDL in one transaction.",
        );
      }

      return finding(
        statement,
        this.id,
        "Concurrent index build",
        "safe",
        `${statement.indexName ?? "The index"} is built without blocking ordinary writes.`,
      );
    },
  },
  {
    id: "add-column-expression-default",
    checks: "ADD COLUMN with a non-literal default rewrites rows",
    evaluate(statement) {
      if (statement.kind !== "alter_table" || !hasAction(statement, "add_column") || !statement.hasExpressionDefault) {
        return null;
      }

      return finding(
        statement,
        this.id,
        "Expression default on new column",
        "unsafe",
        `A non-literal default can force Postgres to evaluate existing rows on ${tableName(statement)} or depend on version-specific behavior.`,
        `ALTER TABLE ${tableName(statement)} ADD COLUMN ...;\nALTER TABLE ${tableName(statement)} ALTER COLUMN ... SET DEFAULT ...;\n-- Backfill in batches before depending on the value.`,
      );
    },
  },
  {
    id: "add-column-constant-default",
    checks: "ADD COLUMN with a literal default is metadata-only",
    evaluate(statement) {
      if (
        statement.kind !== "alter_table" ||
        !hasAction(statement, "add_column") ||
        !statement.hasDefault ||
        statement.hasExpressionDefault
      ) {
        return null;
      }

      return finding(
        statement,
        this.id,
        "Constant column default",
        "safe",
        "Literal defaults are metadata-only on modern Postgres versions and do not rewrite existing rows.",
      );
    },
  },
  {
    id: "alter-column-type",
    checks: "ALTER COLUMN TYPE, gated on table size",
    evaluate(statement, _migration, context) {
      if (statement.kind !== "alter_table" || !hasAction(statement, "alter_column_type")) {
        return null;
      }

      if (!context.tableSize) {
        return {
          ...finding(
            statement,
            this.id,
            "Column type rewrite needs table size",
            "context",
            `Changing a column type can rewrite every row in ${tableName(statement)} under a strong lock.`,
          ),
          question: {
            id: "table-size",
            table: tableName(statement),
            label: `How large is ${tableName(statement)}?`,
            reason: "ALTER COLUMN TYPE can rewrite the table.",
          },
        };
      }

      if (context.tableSize === "small") {
        return finding(
          statement,
          this.id,
          "Small table rewrite",
          "safe",
          `${tableName(statement)} is small enough that a rewrite is unlikely to create meaningful downtime.`,
        );
      }

      return finding(
        statement,
        this.id,
        "Large table rewrite",
        "unsafe",
        `${tableName(statement)} is large enough that rewriting it under ACCESS EXCLUSIVE can become downtime.`,
        "Create a new column, backfill in batches, dual-write during deploy, then swap names in a short final migration.",
      );
    },
  },
  {
    id: "foreign-key-validates-immediately",
    checks: "ADD FOREIGN KEY without NOT VALID scans the table",
    evaluate(statement, _migration, context) {
      if (
        statement.kind !== "alter_table" ||
        statement.constraintType !== "foreign_key" ||
        statement.constraintValidatesImmediately === false
      ) {
        return null;
      }

      if (!context.tableSize) {
        return {
          ...finding(
            statement,
            this.id,
            "Foreign key validation needs table size",
            "context",
            `Adding a validating foreign key scans ${tableName(statement)} and takes locks on both tables.`,
          ),
          question: {
            id: "table-size",
            table: tableName(statement),
            label: `How large is ${tableName(statement)}?`,
            reason: "validating a new foreign key scans existing rows.",
          },
        };
      }

      if (context.tableSize === "small") {
        return finding(
          statement,
          this.id,
          "Small validating foreign key",
          "safe",
          `${tableName(statement)} is small, so validating existing rows should finish quickly.`,
        );
      }

      return finding(
        statement,
        this.id,
        "Validating foreign key",
        "unsafe",
        `On a busy or large ${tableName(statement)}, the validation scan can block writes longer than you want.`,
        `ALTER TABLE ${tableName(statement)} ADD CONSTRAINT ... FOREIGN KEY (...) REFERENCES ... NOT VALID;\nALTER TABLE ${tableName(statement)} VALIDATE CONSTRAINT ...;`,
      );
    },
  },
  {
    id: "validate-constraint",
    checks: "VALIDATE CONSTRAINT lock strength",
    evaluate(statement) {
      if (statement.kind !== "alter_table" || !hasAction(statement, "validate_constraint")) {
        return null;
      }

      return finding(
        statement,
        this.id,
        "Constraint validation",
        "safe",
        "VALIDATE CONSTRAINT is designed for the second step of a safer foreign-key or check-constraint rollout.",
      );
    },
  },
  {
    id: "set-not-null",
    checks: "SET NOT NULL full-table scan",
    evaluate(statement) {
      if (statement.kind !== "alter_table" || !hasAction(statement, "set_not_null")) {
        return null;
      }

      return finding(
        statement,
        this.id,
        "NOT NULL validation",
        "unsafe",
        `SET NOT NULL can scan ${tableName(statement)} while holding a lock unless a matching validated CHECK already proves the column is filled.`,
        `ALTER TABLE ${tableName(statement)} ADD CONSTRAINT ... CHECK (... IS NOT NULL) NOT VALID;\nALTER TABLE ${tableName(statement)} VALIDATE CONSTRAINT ...;\nALTER TABLE ${tableName(statement)} ALTER COLUMN ... SET NOT NULL;`,
      );
    },
  },
  {
    id: "drop-column",
    checks: "DROP COLUMN against rolling deploys",
    evaluate(statement) {
      if (statement.kind !== "alter_table" || !hasAction(statement, "drop_column")) {
        return null;
      }

      return finding(
        statement,
        this.id,
        "Column drop",
        "unsafe",
        `DROP COLUMN takes ACCESS EXCLUSIVE on ${tableName(statement)} and can break old application code still reading the column.`,
        "Stop reads and writes first, deploy that code, then drop the column in a later migration.",
      );
    },
  },
  {
    id: "rename",
    checks: "RENAME TABLE / COLUMN / CONSTRAINT",
    evaluate(statement) {
      if (statement.kind !== "rename") {
        return null;
      }

      return finding(
        statement,
        this.id,
        "Rename",
        "unsafe",
        "Renames are fast but not backward-compatible with old application code or long-running deploys.",
        "Add the new name, dual-write or keep compatibility code, deploy, then remove the old name later.",
      );
    },
  },
  {
    id: "unique-constraint",
    checks: "ADD CONSTRAINT UNIQUE without USING INDEX",
    evaluate(statement) {
      if (statement.kind !== "alter_table" || statement.constraintType !== "unique") {
        return null;
      }

      return finding(
        statement,
        this.id,
        "Unique constraint build",
        "unsafe",
        "Adding a UNIQUE constraint directly builds the backing index while holding stronger locks than necessary.",
        `CREATE UNIQUE INDEX CONCURRENTLY ...;\nALTER TABLE ${tableName(statement)} ADD CONSTRAINT ... UNIQUE USING INDEX ...;`,
      );
    },
  },
  {
    id: "truncate",
    checks: "TRUNCATE lock strength",
    evaluate(statement) {
      if (statement.kind !== "truncate") {
        return null;
      }

      return finding(
        statement,
        this.id,
        "TRUNCATE",
        "unsafe",
        "TRUNCATE takes ACCESS EXCLUSIVE and is rarely a safe online migration.",
        "Delete in batches, or run the operation during a deliberate maintenance window.",
      );
    },
  },
  {
    id: "rewrite-command",
    checks: "VACUUM FULL and CLUSTER rewrite the table",
    evaluate(statement) {
      if (statement.kind !== "rewrite_command") {
        return null;
      }

      return finding(
        statement,
        this.id,
        "Table rewrite command",
        "unsafe",
        "This rewrites table storage and takes locks that do not belong in a normal online migration.",
        "Use an online migration strategy or run during a planned maintenance window.",
      );
    },
  },
];
