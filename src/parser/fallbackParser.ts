import type { ParsedMigration, ParsedStatement } from "@/src/analysis/types";

export function compactSql(statement: string) {
  return statement.replace(/\s+/g, " ").trim();
}

export function tableFromAlter(statement: string) {
  return (
    statement.match(/alter\s+table\s+(?:if\s+exists\s+)?("?[\w.]"?|\w+(?:\.\w+)?)/i)?.[1] ??
    "this table"
  );
}

export function indexName(statement: string) {
  return (
    statement.match(/create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?("?[\w_]+"?)/i)?.[1] ??
    "the index"
  );
}

function classifyStatement(statement: string, index: number): ParsedStatement {
  const compactSqlText = compactSql(statement);
  const lower = compactSqlText.toLowerCase();
  const isAlterTable = /alter\s+table\b/i.test(lower);
  const isCreateIndex = /create\s+(unique\s+)?index\b/i.test(lower);

  return {
    id: `fallback-${index}-${compactSqlText}`,
    rawSql: statement.trim(),
    compactSql: compactSqlText,
    kind: /^begin\b|^start\s+transaction\b|^commit\b/i.test(lower)
      ? "transaction"
      : isCreateIndex
        ? "create_index"
        : /^\s*truncate\b/i.test(lower)
          ? "truncate"
          : /^\s*(cluster|vacuum\s+full)\b/i.test(lower)
            ? "rewrite_command"
            : isAlterTable && /rename\s+(column|to)\b/i.test(lower)
              ? "rename"
              : isAlterTable
                ? "alter_table"
                : "unknown",
    tableName: isAlterTable ? tableFromAlter(compactSqlText) : undefined,
    indexName: isCreateIndex ? indexName(compactSqlText) : undefined,
    indexConcurrent: /create\s+(unique\s+)?index\s+concurrently\b/i.test(lower),
    indexUnique: /create\s+unique\s+index\b/i.test(lower),
    alterActions: [
      isAlterTable && /add\s+column\b/i.test(lower) ? "add_column" : undefined,
      isAlterTable && /alter\s+column\b/i.test(lower) && /type\b/i.test(lower)
        ? "alter_column_type"
        : undefined,
      isAlterTable && /add\s+constraint\b/i.test(lower) ? "add_constraint" : undefined,
      isAlterTable && /validate\s+constraint\b/i.test(lower) ? "validate_constraint" : undefined,
      isAlterTable && /set\s+not\s+null\b/i.test(lower) ? "set_not_null" : undefined,
      isAlterTable && /drop\s+column\b/i.test(lower) ? "drop_column" : undefined,
    ].filter((action): action is ParsedStatement["alterActions"][number] => Boolean(action)),
    hasDefault: isAlterTable && /default\b/i.test(lower),
    hasExpressionDefault:
      isAlterTable &&
      /default\b/i.test(lower) &&
      !/default\s+('(?:''|[^'])*'|[-+]?\d+(?:\.\d+)?|true|false|null)(?:\s|$|,)/i.test(lower),
    constraintType:
      isAlterTable && /foreign\s+key\b/i.test(lower)
        ? "foreign_key"
        : isAlterTable && /unique\b/i.test(lower)
          ? "unique"
          : undefined,
    constraintValidatesImmediately:
      isAlterTable && /foreign\s+key\b/i.test(lower) ? !/not\s+valid\b/i.test(lower) : undefined,
  };
}

export function parseSqlFallback(sql: string): ParsedMigration {
  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map(classifyStatement);

  return {
    sql,
    statements,
    parser: "fallback",
    diagnostics: statements.length
      ? [{ source: "fallback", message: "Using lightweight text classification while the parser initializes." }]
      : [],
  };
}
