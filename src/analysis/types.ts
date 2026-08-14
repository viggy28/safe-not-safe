export type Verdict = "SAFE" | "NOT_SAFE" | "NEEDS_CONTEXT" | "UNSUPPORTED";

export type FindingSeverity = "safe" | "unsafe" | "context" | "unsupported";

export type TableSize = "small" | "medium" | "large";

export type MigrationContext = {
  tableSize?: TableSize;
  wrapsInTransaction?: boolean;
};

export type ContextQuestion = {
  id: "table-size" | "transaction-wrapper";
  label: string;
  table?: string;
  reason: string;
};

export type Finding = {
  id: string;
  ruleId: string;
  title: string;
  statement: string;
  severity: FindingSeverity;
  why: string;
  fix?: string;
  question?: ContextQuestion;
};

export type ParserDiagnostic = {
  message: string;
  source: "libpg_query" | "fallback";
};

export type Analysis = {
  verdict: Verdict;
  headline: string;
  summary: string;
  findings: Finding[];
  decisiveFinding?: Finding;
  question?: ContextQuestion;
  diagnostics: ParserDiagnostic[];
  parser: "libpg_query" | "fallback";
};

export type StatementKind =
  | "alter_table"
  | "create_index"
  | "transaction"
  | "truncate"
  | "rewrite_command"
  | "rename"
  | "unknown";

export type AlterAction =
  | "add_column"
  | "alter_column_type"
  | "add_constraint"
  | "validate_constraint"
  | "set_not_null"
  | "drop_column"
  | "unknown";

export type ParsedStatement = {
  id: string;
  rawSql: string;
  compactSql: string;
  kind: StatementKind;
  astType?: string;
  ast?: unknown;
  tableName?: string;
  indexName?: string;
  indexConcurrent?: boolean;
  indexUnique?: boolean;
  alterActions: AlterAction[];
  hasDefault?: boolean;
  hasExpressionDefault?: boolean;
  constraintType?: "foreign_key" | "unique" | "other";
  constraintValidatesImmediately?: boolean;
};

export type ParsedMigration = {
  sql: string;
  statements: ParsedStatement[];
  parser: "libpg_query" | "fallback";
  diagnostics: ParserDiagnostic[];
};

export type Rule = {
  id: string;
  evaluate: (
    statement: ParsedStatement,
    migration: ParsedMigration,
    context: MigrationContext,
  ) => Finding | null;
};
