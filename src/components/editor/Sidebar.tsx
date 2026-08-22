"use client";

import type { TableSize } from "@/src/analysis/types";

export const TABLE_SIZE_OPTIONS: Array<{ key: TableSize; label: string }> = [
  { key: "small", label: "Under 50k" },
  { key: "medium", label: "50k to 5M" },
  { key: "large", label: "Over 5M" },
];

export type SidebarBuffer = {
  id: number;
  name: string;
  count?: number;
};

type SidebarProps = {
  buffers: SidebarBuffer[];
  activeId: number;
  canClose: boolean;
  onSelect: (id: number) => void;
  onClose: (id: number) => void;
  tableSize?: TableSize;
  onTableSize: (size: TableSize) => void;
  wrapsInTransaction: boolean;
  onWrapsInTransaction: (checked: boolean) => void;
  samples: Array<{ label: string; name: string; sql: string }>;
  onOpenSample: (name: string, sql: string) => void;
};

export function Sidebar({
  buffers,
  activeId,
  canClose,
  onSelect,
  onClose,
  tableSize,
  onTableSize,
  wrapsInTransaction,
  onWrapsInTransaction,
  samples,
  onOpenSample,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-section-head">
        <span className="sidebar-section-title">Session</span>
        <span className="sidebar-count">{buffers.length} open</span>
      </div>

      <div className="sidebar-buffers">
        {buffers.map((buffer) => (
          <div
            key={buffer.id}
            className={`sidebar-buffer-row${buffer.id === activeId ? " is-active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(buffer.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(buffer.id);
              }
            }}
          >
            <span className="sidebar-buffer-name">
              <span className="sidebar-bullet">◦</span>
              <span className="sidebar-buffer-label">{buffer.name}</span>
            </span>
            <span className="sidebar-buffer-meta">
              <span className="sidebar-stmt-count">
                {buffer.count === undefined ? "…" : buffer.count} stmt
              </span>
              {canClose ? (
                <button
                  type="button"
                  className="sidebar-close"
                  aria-label={`Close ${buffer.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose(buffer.id);
                  }}
                >
                  ✕
                </button>
              ) : null}
            </span>
          </div>
        ))}
        <p className="sidebar-caption">Buffers live in this tab only. Nothing is saved to disk.</p>
      </div>

      <div className="sidebar-section-head">
        <span className="sidebar-section-title">Context</span>
      </div>

      <div className="sidebar-context">
        <span className="sidebar-context-label">Rows in target table</span>
        <div className="sidebar-size-group" role="radiogroup" aria-label="Rows in target table">
          {TABLE_SIZE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={tableSize === option.key}
              className={`sidebar-size-btn${tableSize === option.key ? " is-selected" : ""}`}
              onClick={() => onTableSize(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="sidebar-check">
          <input
            type="checkbox"
            checked={wrapsInTransaction}
            onChange={(event) => onWrapsInTransaction(event.target.checked)}
          />
          <span>Tool wraps DDL in a transaction</span>
        </label>
      </div>

      <div className="sidebar-section-head">
        <span className="sidebar-section-title">Samples</span>
      </div>

      <div className="sidebar-samples">
        {samples.map((sample) => (
          <button
            key={sample.label}
            type="button"
            className="sidebar-sample-btn"
            onClick={() => onOpenSample(sample.name, sample.sql)}
          >
            {sample.label}
          </button>
        ))}
      </div>

      <span className="sidebar-spacer" />

      <p className="sidebar-footer">
        Nothing is uploaded. The parser runs in a web worker in this tab.
      </p>
    </aside>
  );
}
