import type { Analysis, MigrationContext } from "@/src/analysis/types";

type WorkerSuccess = {
  id: number;
  ok: true;
  analysis: Analysis;
};

let requestId = 0;
let worker: Worker | undefined;

function getWorker() {
  worker ??= new Worker(new URL("./parserWorker.ts", import.meta.url), {
    type: "module",
  });

  return worker;
}

export function analyzeMigrationInWorker(sql: string, context: MigrationContext): Promise<Analysis> {
  const id = ++requestId;

  return new Promise((resolve, reject) => {
    const activeWorker = getWorker();
    const timeout = window.setTimeout(() => {
      activeWorker.removeEventListener("message", onMessage);
      activeWorker.removeEventListener("error", onError);
      reject(new Error("Parser worker timed out"));
    }, 5000);

    function cleanup() {
      window.clearTimeout(timeout);
      activeWorker.removeEventListener("message", onMessage);
      activeWorker.removeEventListener("error", onError);
    }

    function onMessage(event: MessageEvent<WorkerSuccess>) {
      if (event.data.id !== id) {
        return;
      }

      cleanup();
      resolve(event.data.analysis);
    }

    function onError(event: ErrorEvent) {
      cleanup();
      reject(event.error instanceof Error ? event.error : new Error(event.message));
    }

    activeWorker.addEventListener("message", onMessage);
    activeWorker.addEventListener("error", onError);
    activeWorker.postMessage({ id, sql, context });
  });
}
