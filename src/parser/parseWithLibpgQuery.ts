import type { ParsedMigration } from "@/src/analysis/types";
import { normalizeLibpgQueryResult } from "@/src/parser/normalizeAst";
import {
  DEFAULT_POSTGRES_VERSION,
  type PostgresVersion,
} from "@/src/parser/postgresVersion";

function assertParserVersion(result: unknown, requestedVersion: PostgresVersion) {
  if (!result || typeof result !== "object" || !("version" in result)) {
    return;
  }

  const rawVersion = (result as { version?: unknown }).version;
  if (typeof rawVersion !== "number") {
    return;
  }

  const actualVersion = Math.floor(rawVersion / 10_000);
  if (actualVersion !== requestedVersion) {
    throw new Error(
      `PostgreSQL ${requestedVersion} parser returned a PostgreSQL ${actualVersion} parse tree`,
    );
  }
}

export async function parseSqlWithLibpgQuery(
  sql: string,
  postgresVersion: PostgresVersion = DEFAULT_POSTGRES_VERSION,
): Promise<ParsedMigration> {
  if (!sql.trim()) {
    return normalizeLibpgQueryResult(sql, { stmts: [] }, postgresVersion);
  }

  const result = import.meta.env.SSR
    ? await import("@/src/parser/nodeLibpgQuery").then((module) =>
        module.parseSqlInNode(sql, postgresVersion),
      )
    : await import("@/src/parser/browserLibpgQuery").then((module) =>
        module.parseSqlInBrowserWithWasmAsset(sql, postgresVersion),
      );

  assertParserVersion(result, postgresVersion);
  return normalizeLibpgQueryResult(sql, result, postgresVersion);
}
