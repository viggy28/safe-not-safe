"use client";

import { useEffect, useMemo, useState } from "react";
import type { Analysis, MigrationContext, TableSize } from "@/src/analysis/types";
import {
  analyzeMigrationInWorker,
  initializeParserWorker,
  restartParserWorker,
  type ParserState,
} from "@/src/parser/parserClient";
import { safeSample, unsafeSample } from "@/src/examples/examples";
import { verdictMeta } from "@/src/ui/verdictMeta";
import type { Buffer, Cursor, PanelTab } from "@/src/ui/types";
import { TitleBar } from "@/src/components/editor/TitleBar";
import { ActivityBar } from "@/src/components/editor/ActivityBar";
import { Sidebar } from "@/src/components/editor/Sidebar";
import { TabStrip } from "@/src/components/editor/TabStrip";
import { Breadcrumb } from "@/src/components/editor/Breadcrumb";
import { EditorPane } from "@/src/components/editor/EditorPane";
import { VerdictBanner } from "@/src/components/editor/VerdictBanner";
import { TerminalPanel } from "@/src/components/editor/TerminalPanel";
import { StatusBar } from "@/src/components/editor/StatusBar";

type WorkerStatus = "initializing" | "ready" | "error";

const INITIAL_BUFFER: Buffer = { id: 1, name: "migration.sql", sql: safeSample };

const SAMPLES: Array<{ label: string; name: string; sql: string }> = [
  { label: "risky.sql", name: "risky.sql", sql: unsafeSample },
  { label: "safe.sql", name: "safe.sql", sql: safeSample },
  { label: "empty buffer", name: "untitled.sql", sql: "" },
];

function inputKey(sql: string, context: MigrationContext) {
  return `${sql}\u0000${context.tableSize ?? ""}\u0000${context.wrapsInTransaction ? "1" : "0"}`;
}

function pendingAnalysis(sql: string, parserState: ParserState, parserError?: string): Analysis {
  if (!sql.trim()) {
    return {
      verdict: "NO_INPUT",
      headline: "Waiting on SQL.",
      summary: "Paste a migration, or load one of the samples.",
      findings: [],
      diagnostics: [],
      parser: "libpg_query",
      statements: [],
    };
  }

  if (parserState === "error") {
    return {
      verdict: "PARSER_ERROR",
      headline: "PostgreSQL parser unavailable.",
      summary: parserError ?? "The WASM parser could not be initialized. Retry before trusting a verdict.",
      findings: [],
      diagnostics: parserError ? [{ source: "libpg_query", message: parserError }] : [],
      parser: "libpg_query",
      statements: [],
    };
  }

  return {
    verdict: "CHECKING",
    headline: parserState === "initializing" ? "Loading PostgreSQL parser." : "Checking this migration.",
    summary:
      parserState === "initializing"
        ? "Downloading and compiling libpg_query WASM in a browser worker."
        : "The authoritative PostgreSQL parser is analyzing the latest SQL.",
    findings: [],
    diagnostics: [],
    parser: "libpg_query",
    statements: [],
  };
}

export default function Home() {
  const [buffers, setBuffers] = useState<Buffer[]>([INITIAL_BUFFER]);
  const [activeId, setActiveId] = useState(1);
  const [nextId, setNextId] = useState(2);
  const [tableSize, setTableSize] = useState<TableSize | undefined>();
  const [wrapsInTransaction, setWrapsInTransaction] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("terminal");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [cursor, setCursor] = useState<Cursor>({ line: 1, col: 1 });
  const [recheckTick, setRecheckTick] = useState(0);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>("initializing");
  const [parserError, setParserError] = useState<string>();
  const [analysisCache, setAnalysisCache] = useState<
    Record<number, { key: string; analysis: Analysis }>
  >({});
  const [statementCounts, setStatementCounts] = useState<Record<number, number>>({});

  const activeBuffer = buffers.find((buffer) => buffer.id === activeId) ?? buffers[0];
  const context: MigrationContext = useMemo(
    () => ({ tableSize, wrapsInTransaction }),
    [tableSize, wrapsInTransaction],
  );
  const currentKey = inputKey(activeBuffer.sql, context);
  const cachedEntry = analysisCache[activeId];
  const cachedAnalysis = cachedEntry?.key === currentKey ? cachedEntry.analysis : undefined;
  const parserState: ParserState =
    workerStatus === "error"
      ? "error"
      : workerStatus === "initializing"
        ? "initializing"
        : cachedAnalysis
          ? "ready"
          : "analyzing";
  const analysis =
    parserState === "error"
      ? pendingAnalysis(activeBuffer.sql, parserState, parserError)
      : cachedAnalysis ?? pendingAnalysis(activeBuffer.sql, parserState, parserError);
  const verdict = verdictMeta[analysis.verdict];
  const statementCount = analysis.statements.length;
  const problemCount = analysis.findings.filter((finding) => finding.severity !== "safe").length;

  useEffect(() => {
    let cancelled = false;

    initializeParserWorker().then(
      () => {
        if (!cancelled) {
          setWorkerStatus("ready");
          setParserError(undefined);
        }
      },
      (error) => {
        if (!cancelled) {
          setWorkerStatus("error");
          setParserError(error instanceof Error ? error.message : "PostgreSQL parser initialization failed");
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (workerStatus !== "ready") {
      return;
    }

    let cancelled = false;
    const key = inputKey(activeBuffer.sql, context);
    const bufferId = activeBuffer.id;
    const timeout = window.setTimeout(() => {
      analyzeMigrationInWorker(activeBuffer.sql, context).then(
        (result) => {
          if (!cancelled) {
            setAnalysisCache((current) => ({
              ...current,
              [bufferId]: { key, analysis: result },
            }));
            setStatementCounts((current) => ({ ...current, [bufferId]: result.statements.length }));
          }
        },
        (error) => {
          if (!cancelled) {
            setWorkerStatus("error");
            setParserError(error instanceof Error ? error.message : "PostgreSQL parser worker failed");
          }
        },
      );
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [activeBuffer.id, activeBuffer.sql, context, recheckTick, workerStatus]);

  function retryParser() {
    setWorkerStatus("initializing");
    setParserError(undefined);
    restartParserWorker().then(
      () => setWorkerStatus("ready"),
      (error) => {
        setWorkerStatus("error");
        setParserError(error instanceof Error ? error.message : "PostgreSQL parser initialization failed");
      },
    );
  }

  function recheck() {
    if (workerStatus === "error") {
      retryParser();
      return;
    }

    setAnalysisCache((current) => {
      const next = { ...current };
      delete next[activeId];
      return next;
    });
    setRecheckTick((current) => current + 1);
  }

  function updateActiveSql(sql: string) {
    setBuffers((current) => current.map((buffer) => (buffer.id === activeId ? { ...buffer, sql } : buffer)));
    setStatementCounts((current) => {
      const next = { ...current };
      delete next[activeId];
      return next;
    });
  }

  function selectBuffer(id: number) {
    setActiveId(id);
  }

  function closeBuffer(id: number) {
    setBuffers((current) => {
      if (current.length < 2) {
        return current;
      }

      const remaining = current.filter((buffer) => buffer.id !== id);
      if (id === activeId) {
        setActiveId(remaining[remaining.length - 1].id);
      }
      return remaining;
    });
    setStatementCounts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setAnalysisCache((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function openBuffer(name: string, sql: string) {
    setBuffers((current) => [...current, { id: nextId, name, sql }]);
    setActiveId(nextId);
    setNextId((current) => current + 1);
    setTableSize(undefined);
    setWrapsInTransaction(false);
  }

  function handleTableSize(size: TableSize) {
    setTableSize((current) => (current === size ? undefined : size));
  }

  function handleCursorChange(next: Cursor) {
    setCursor((current) => (current.line === next.line && current.col === next.col ? current : next));
  }

  const sidebarBuffers = buffers.map((buffer) => ({
    id: buffer.id,
    name: buffer.name,
    count: statementCounts[buffer.id],
  }));

  return (
    <main className="page">
      <div className="shell-frame">
        <TitleBar
          activeName={activeBuffer.name}
          onRecheck={recheck}
          onNewBuffer={() => openBuffer("untitled.sql", "")}
          onCloseBuffer={() => closeBuffer(activeId)}
        />

        <div className="shell-main">
          <ActivityBar
            verdictLight={verdict.light}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((current) => !current)}
            onRecheck={recheck}
          />

          {sidebarOpen ? (
            <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          ) : null}

          <div className={`sidebar${sidebarOpen ? " is-open" : ""}`}>
            <Sidebar
              buffers={sidebarBuffers}
              activeId={activeId}
              canClose={buffers.length > 1}
              onSelect={selectBuffer}
              onClose={closeBuffer}
              tableSize={tableSize}
              onTableSize={handleTableSize}
              wrapsInTransaction={wrapsInTransaction}
              onWrapsInTransaction={setWrapsInTransaction}
              samples={SAMPLES}
              onOpenSample={openBuffer}
            />
          </div>

          <div className="shell-content">
            <TabStrip
              activeName={activeBuffer.name}
              verdictLight={verdict.light}
              verdictLabel={verdict.label}
              canClose={buffers.length > 1}
              onClose={() => closeBuffer(activeId)}
            />

            <Breadcrumb activeName={activeBuffer.name} statementCount={statementCount} />

            <EditorPane
              key={activeId}
              sql={activeBuffer.sql}
              onChange={updateActiveSql}
              onCursorChange={handleCursorChange}
            />

            <VerdictBanner
              verdict={verdict}
              headline={analysis.headline}
              summary={analysis.summary}
              problemCount={problemCount}
              statementCount={statementCount}
            />

            <TerminalPanel
              panelTab={panelTab}
              onTabChange={setPanelTab}
              analysis={analysis}
              verdict={verdict}
              parserState={parserState}
              activeName={activeBuffer.name}
              charCount={activeBuffer.sql.length}
              onRetryParser={retryParser}
            />
          </div>
        </div>

        <StatusBar
          verdict={verdict}
          problemCount={problemCount}
          statementCount={statementCount}
          cursor={cursor}
        />
      </div>

      <footer className="footer-copy">
        <span>Your SQL never leaves the browser. No API route, no logs, no account.</span>
        <span>Yes, the name is a database joke about a hot dog joke.</span>
      </footer>
    </main>
  );
}
