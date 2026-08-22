import ParserWorker from "@/src/parser/parserWorker?worker";
import type { Analysis, MigrationContext } from "@/src/analysis/types";

export type ParserState = "initializing" | "analyzing" | "ready" | "error";

type WorkerReady = { type: "ready" };
type WorkerInitError = { type: "init-error"; message: string };
type WorkerResult = { type: "result"; id: number; analysis: Analysis };
type WorkerMessage = WorkerReady | WorkerInitError | WorkerResult;

type PendingRequest = {
  resolve: (analysis: Analysis) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type WorkerSession = {
  worker: Worker;
  ready: Promise<void>;
  resolveReady: () => void;
  rejectReady: (error: Error) => void;
  initializationTimeout: ReturnType<typeof setTimeout>;
  pending: Map<number, PendingRequest>;
};

const INITIALIZATION_TIMEOUT_MS = 30_000;
const ANALYSIS_TIMEOUT_MS = 15_000;

let requestId = 0;
let session: WorkerSession | undefined;

function asError(error: unknown, fallback: string) {
  return error instanceof Error ? error : new Error(fallback);
}

function rejectPending(activeSession: WorkerSession, error: Error) {
  for (const pending of activeSession.pending.values()) {
    clearTimeout(pending.timeout);
    pending.reject(error);
  }
  activeSession.pending.clear();
}

function createSession(): WorkerSession {
  const worker = new ParserWorker();
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const activeSession: WorkerSession = {
    worker,
    ready,
    resolveReady,
    rejectReady,
    initializationTimeout: setTimeout(() => {
      const error = new Error("PostgreSQL parser initialization timed out");
      activeSession.rejectReady(error);
      rejectPending(activeSession, error);
    }, INITIALIZATION_TIMEOUT_MS),
    pending: new Map(),
  };

  worker.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
    const message = event.data;

    if (message.type === "ready") {
      clearTimeout(activeSession.initializationTimeout);
      activeSession.resolveReady();
      return;
    }

    if (message.type === "init-error") {
      clearTimeout(activeSession.initializationTimeout);
      const error = new Error(message.message);
      activeSession.rejectReady(error);
      rejectPending(activeSession, error);
      return;
    }

    const pending = activeSession.pending.get(message.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    activeSession.pending.delete(message.id);
    pending.resolve(message.analysis);
  });

  worker.addEventListener("error", (event) => {
    clearTimeout(activeSession.initializationTimeout);
    const error = asError(event.error, event.message || "PostgreSQL parser worker failed");
    activeSession.rejectReady(error);
    rejectPending(activeSession, error);
  });

  return activeSession;
}

function getSession() {
  session ??= createSession();
  return session;
}

/** Start the worker and eagerly download/compile libpg_query WASM. */
export function initializeParserWorker(): Promise<void> {
  return getSession().ready;
}

/** Terminate a failed worker and initialize a new one. */
export function restartParserWorker(): Promise<void> {
  if (session) {
    const error = new Error("PostgreSQL parser worker restarted");
    clearTimeout(session.initializationTimeout);
    rejectPending(session, error);
    session.worker.terminate();
    session = undefined;
  }

  return initializeParserWorker();
}

export async function analyzeMigrationInWorker(
  sql: string,
  context: MigrationContext,
): Promise<Analysis> {
  const activeSession = getSession();
  await activeSession.ready;
  const id = ++requestId;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      activeSession.pending.delete(id);
      reject(new Error("PostgreSQL parser analysis timed out"));
    }, ANALYSIS_TIMEOUT_MS);

    activeSession.pending.set(id, { resolve, reject, timeout });
    activeSession.worker.postMessage({ id, sql, context });
  });
}
