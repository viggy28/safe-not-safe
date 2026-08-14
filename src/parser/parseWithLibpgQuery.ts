import type { ParsedMigration } from "@/src/analysis/types";
import { normalizeLibpgQueryResult } from "@/src/parser/normalizeAst";

export async function parseSqlWithLibpgQuery(sql: string): Promise<ParsedMigration> {
  if (!sql.trim()) {
    return {
      sql,
      statements: [],
      parser: "libpg_query",
      diagnostics: [],
    };
  }

  const runsInBrowser = typeof window !== "undefined" || typeof self !== "undefined";
  const result =
    !runsInBrowser
      ? await import("@libpg-query/parser").then((module) => module.parse(sql))
      : await import("@/src/parser/browserLibpgQuery").then((module) =>
          module.parseSqlInBrowserWithWasmAsset(sql),
        );

  return normalizeLibpgQueryResult(sql, result);
}
