"use client";

import type { VerdictMeta } from "@/src/ui/verdictMeta";
import type { PostgresVersion } from "@/src/parser/postgresVersion";

type StatusBarProps = {
  verdict: VerdictMeta;
  problemCount: number;
  statementCount: number;
  cursor: { line: number; col: number };
  postgresVersion: PostgresVersion;
};

export function StatusBar({
  verdict,
  problemCount,
  statementCount,
  cursor,
  postgresVersion,
}: StatusBarProps) {
  return (
    <div className="status-bar" style={{ background: verdict.light }}>
      <span className="status-verdict">{verdict.label}</span>
      <span className="status-meta">
        {problemCount} flagged · {statementCount} statements
      </span>
      <span className="status-spacer" />
      <span className="status-meta status-mobile-hidden">Ln {cursor.line}, Col {cursor.col}</span>
      <span className="status-meta status-mobile-hidden">PostgreSQL {postgresVersion}</span>
      <span className="status-meta status-mobile-hidden">SQL</span>
      <span className="status-meta status-mobile-hidden">no telemetry</span>
      <a
        className="status-link"
        href="https://github.com/viggy28/safe-not-safe"
        target="_blank"
        rel="noreferrer"
      >
        GitHub
      </a>
    </div>
  );
}
