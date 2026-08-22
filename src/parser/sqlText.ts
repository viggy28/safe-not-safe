export function compactSql(statement: string) {
  return statement.replace(/\s+/g, " ").trim();
}

export function tableFromAlter(statement: string) {
  return (
    statement.match(/alter\s+table\s+(?:if\s+exists\s+)?("?[\w.]+"?)/i)?.[1] ??
    "this table"
  );
}

export function indexName(statement: string) {
  return (
    statement.match(/create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?("?[\w_]+"?)/i)?.[1] ??
    "the index"
  );
}
