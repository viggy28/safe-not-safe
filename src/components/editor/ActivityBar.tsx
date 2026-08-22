"use client";

type ActivityBarProps = {
  verdictLight: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onRecheck: () => void;
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ActivityBar({
  verdictLight,
  sidebarOpen,
  onToggleSidebar,
  onRecheck,
}: ActivityBarProps) {
  return (
    <nav className="activity-bar" aria-label="Activity bar">
      <button
        type="button"
        className={`activity-btn${sidebarOpen ? " is-active" : ""}`}
        onClick={onToggleSidebar}
        aria-pressed={sidebarOpen}
        title="Toggle session panel"
      >
        <Icon>
          <path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
          <path d="M13 3v6h6" />
        </Icon>
      </button>

      <span className="activity-btn" role="img" aria-label="Search">
        <Icon>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m21 21-4.3-4.3" />
        </Icon>
      </span>

      <span className="activity-btn" role="img" aria-label="Source control">
        <Icon>
          <circle cx="6" cy="6" r="2.3" />
          <circle cx="6" cy="18" r="2.3" />
          <path d="M6 8.3v7.4" />
          <path d="M18 8c0 3.3-2.4 4-6.5 4" />
        </Icon>
      </span>

      <button
        type="button"
        className="activity-btn"
        title="Run check"
        aria-label="Run check"
        onClick={onRecheck}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path d="M7 5l12 7-12 7z" fill="currentColor" />
        </svg>
      </button>

      <span className="activity-btn" role="img" aria-label="Verdict" style={{ color: verdictLight }}>
        <Icon>
          <path d="M5 3v18" />
          <path d="M5 4h12l-2 4 2 4H5" />
        </Icon>
      </span>

      <span className="activity-spacer" />

      <span className="activity-btn" role="img" aria-label="Settings">
        <Icon>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.1 5.1l1.8 1.8M17.1 17.1l1.8 1.8M18.9 5.1l-1.8 1.8M6.9 17.1l-1.8 1.8" />
        </Icon>
      </span>
    </nav>
  );
}
