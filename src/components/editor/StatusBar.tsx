"use client";

import type { VerdictMeta } from "@/src/ui/verdictMeta";

type StatusBarProps = {
  verdict: VerdictMeta;
  problemCount: number;
  statementCount: number;
  cursor: { line: number; col: number };
};

export function StatusBar({ verdict, problemCount, statementCount, cursor }: StatusBarProps) {
  return (
    <div className="status-bar" style={{ background: verdict.light }}>
      <span className="status-verdict">{verdict.label}</span>
      <span className="status-meta">
        {problemCount} flagged · {statementCount} statements
      </span>
      <span className="status-spacer" />
      <span className="status-meta">Ln {cursor.line}, Col {cursor.col}</span>
      <span className="status-meta">PostgreSQL 16</span>
      <span className="status-meta">SQL</span>
      <span className="status-meta">no telemetry</span>
    </div>
  );
}
