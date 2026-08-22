import type { MigrationContext } from "@/src/analysis/types";
import { analyzeParsedMigration, parseErrorAnalysis } from "@/src/analysis/analyzeMigration";
import { initializeBrowserLibpgQuery } from "@/src/parser/browserLibpgQuery";
import { parseSqlWithLibpgQuery } from "@/src/parser/parseWithLibpgQuery";

type WorkerRequest = {
  id: number;
  sql: string;
  context: MigrationContext;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown parser error";
}

// Begin downloading and compiling libpg_query as soon as the worker starts.
// Every request awaits the same cached promise, so initialization happens once.
const parserReady = initializeBrowserLibpgQuery();

parserReady.then(
  () => self.postMessage({ type: "ready" }),
  (error) => self.postMessage({ type: "init-error", message: errorMessage(error) }),
);

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, sql, context } = event.data;

  try {
    await parserReady;
    const parsed = await parseSqlWithLibpgQuery(sql);
    const analysis = analyzeParsedMigration(parsed, context);
    self.postMessage({ type: "result", id, analysis });
  } catch (error) {
    self.postMessage({
      type: "result",
      id,
      analysis: parseErrorAnalysis(sql, errorMessage(error)),
    });
  }
};
