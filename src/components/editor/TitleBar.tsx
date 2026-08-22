"use client";

import { useState } from "react";

const MENU_ITEMS = [
  { label: "File", decorative: false },
  { label: "Edit", decorative: true },
  { label: "Selection", decorative: true },
  { label: "View", decorative: true },
  { label: "Check", decorative: false },
  { label: "Help", decorative: true },
] as const;

type TitleBarProps = {
  activeName: string;
  onRecheck: () => void;
  onNewBuffer: () => void;
  onCloseBuffer: () => void;
};

export function TitleBar({ activeName, onRecheck, onNewBuffer, onCloseBuffer }: TitleBarProps) {
  const [fileOpen, setFileOpen] = useState(false);

  function handleMenu(label: string) {
    if (label === "Check") {
      onRecheck();
    }
  }

  return (
    <div className="title-bar">
      <span className="traffic-lights" aria-hidden="true">
        <span className="tl tl-red" />
        <span className="tl tl-yellow" />
        <span className="tl tl-green" />
      </span>

      <div className="menu-bar" role="menubar">
        {MENU_ITEMS.map((item) =>
          item.label === "File" ? (
            <div key={item.label} className="menu-wrap">
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => setFileOpen((open) => !open)}
                onBlur={() => setFileOpen(false)}
                aria-haspopup="menu"
                aria-expanded={fileOpen}
              >
                {item.label}
              </button>
              {fileOpen ? (
                <div className="menu-dropdown" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setFileOpen(false);
                      onNewBuffer();
                    }}
                  >
                    New buffer
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setFileOpen(false);
                      onCloseBuffer();
                    }}
                  >
                    Close buffer
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="menu-item"
              data-decorative={item.decorative ? "" : undefined}
              onClick={() => handleMenu(item.label)}
            >
              {item.label}
            </button>
          ),
        )}
      </div>

      <div className="title-center">
        <div className="title-chip">
          <svg
            className="title-favicon"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M22 19.2727C22 20.779 20.779 22 19.2727 22H14.7273C13.221 22 12 20.779 12 19.2727V12H19.2727C20.779 12 22 13.221 22 14.7273V19.2727Z" fill="#68C4FF" />
            <path d="M20 2C21.1046 2 22 2.89543 22 4V7C22 8.10457 21.1046 9 20 9H17C15.8954 9 15 8.10457 15 7V4C15 2.89543 15.8954 2 17 2H20Z" fill="#0C79D8" />
            <path d="M7 15C8.10457 15 9 15.8954 9 17V20C9 21.1046 8.10457 22 7 22H4C2.89543 22 2 21.1046 2 20V17C2 15.8954 2.89543 15 4 15H7Z" fill="#0C79D8" />
            <path d="M12 12H4.72727C3.22104 12 2 10.779 2 9.27273V4.72727C2 3.22104 3.22104 2 4.72727 2H9.27273C10.779 2 12 3.22104 12 4.72727V12Z" fill="#2E9EFF" />
          </svg>
          <span>safe-not-safe — {activeName}</span>
        </div>
      </div>

      <span className="title-offline">offline</span>
    </div>
  );
}
