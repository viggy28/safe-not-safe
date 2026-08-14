import type { MigrationContext } from "@/src/analysis/types";
import { analyzeParsedMigration, parseErrorAnalysis } from "@/src/analysis/analyzeMigration";
import { parseSqlWithLibpgQuery } from "@/src/parser/parseWithLibpgQuery";

type WorkerRequest = {
  id: number;
  sql: string;
  context: MigrationContext;
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, sql, context } = event.data;

  try {
    const parsed = await parseSqlWithLibpgQuery(sql);
    const analysis = analyzeParsedMigration(parsed, context);
    self.postMessage({ id, ok: true, analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parser error";
    self.postMessage({ id, ok: true, analysis: parseErrorAnalysis(sql, message) });
  }
};
