import type { MigrationContext } from "@/src/analysis/types";
import { analyzeParsedMigration, parseErrorAnalysis } from "@/src/analysis/analyzeMigration";
import { initializeBrowserLibpgQuery } from "@/src/parser/browserLibpgQuery";
import { parseSqlWithLibpgQuery } from "@/src/parser/parseWithLibpgQuery";
import { DEFAULT_POSTGRES_VERSION } from "@/src/parser/postgresVersion";

type WorkerRequest = {
  id: number;
  sql: string;
  context: MigrationContext;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown parser error";
}

// Signal that the worker is available. Individual PostgreSQL parser builds are
// downloaded lazily when their version is first requested.
self.postMessage({ type: "ready" });

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, sql, context } = event.data;
  const postgresVersion = context.postgresVersion ?? DEFAULT_POSTGRES_VERSION;

  try {
    await initializeBrowserLibpgQuery(postgresVersion);
  } catch (error) {
    self.postMessage({
      type: "request-error",
      id,
      message: errorMessage(error),
    });
    return;
  }

  try {
    const parsed = await parseSqlWithLibpgQuery(sql, postgresVersion);
    const analysis = analyzeParsedMigration(parsed, context);
    self.postMessage({ type: "result", id, analysis });
  } catch (error) {
    self.postMessage({
      type: "result",
      id,
      analysis: parseErrorAnalysis(sql, errorMessage(error), postgresVersion),
    });
  }
};
