"use client";

type TabStripProps = {
  activeName: string;
  verdictLight: string;
  verdictLabel: string;
  canClose: boolean;
  onClose: () => void;
};

export function TabStrip({ activeName, verdictLight, verdictLabel, canClose, onClose }: TabStripProps) {
  return (
    <div className="tab-strip">
      <div className="tab tab-active" style={{ boxShadow: `inset 0 2px 0 ${verdictLight}` }}>
        <span className="tab-diamond" style={{ color: verdictLight }}>
          ◆
        </span>
        <span className="tab-name">{activeName}</span>
        {canClose ? (
          <button type="button" className="tab-close" aria-label="Close buffer" onClick={onClose}>
            ✕
          </button>
        ) : (
          <span className="tab-close" aria-hidden="true">
            ✕
          </span>
        )}
      </div>

      <span className="tab-strip-spacer" />

      <div className="tab-verdict" style={{ color: verdictLight }}>
        <span className="tab-verdict-dot" style={{ background: verdictLight }} />
        <span>{verdictLabel}</span>
      </div>

      <div className="tab-actions">
        <span>⌥⇧F</span>
        <span>⋯</span>
      </div>
    </div>
  );
}
