"use client";

import type { VerdictMeta } from "@/src/ui/verdictMeta";

type VerdictBannerProps = {
  verdict: VerdictMeta;
  headline: string;
  summary: string;
  problemCount: number;
  statementCount: number;
};

export function VerdictBanner({
  verdict,
  headline,
  summary,
  problemCount,
  statementCount,
}: VerdictBannerProps) {
  return (
    <div className="verdict-banner" style={{ background: verdict.soft }}>
      <strong className="verdict-word" style={{ color: verdict.light }}>
        {verdict.label}
      </strong>
      <div className="verdict-copy">
        <div className="verdict-headline">{headline}</div>
        <div className="verdict-summary">{summary}</div>
      </div>
      <span className="verdict-spacer" />
      <span className="verdict-count">
        {problemCount} flagged of {statementCount}
      </span>
    </div>
  );
}
