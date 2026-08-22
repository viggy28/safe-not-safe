"use client";

type BreadcrumbProps = {
  activeName: string;
  statementCount: number;
};

export function Breadcrumb({ activeName, statementCount }: BreadcrumbProps) {
  return (
    <div className="breadcrumb" aria-label="Breadcrumb">
      <span>session</span>
      <span className="breadcrumb-sep">›</span>
      <span>{activeName}</span>
      <span className="breadcrumb-sep">›</span>
      <span className="breadcrumb-current">
        {statementCount} statement{statementCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}
