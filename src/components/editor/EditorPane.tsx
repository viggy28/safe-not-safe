"use client";

import { useEffect, useRef } from "react";
import type { Cursor } from "@/src/ui/types";

type EditorPaneProps = {
  sql: string;
  onChange: (sql: string) => void;
  onCursorChange?: (cursor: Cursor) => void;
};

function cursorAt(el: HTMLTextAreaElement): Cursor {
  const before = el.value.slice(0, el.selectionStart);
  const lines = before.split("\n");
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

export function EditorPane({ sql, onChange, onCursorChange }: EditorPaneProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lineCount = sql.split("\n").length;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }

    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    onCursorChange?.(cursorAt(el));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncScroll(top: number) {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = top;
    }
  }

  function reportCursor(event: React.SyntheticEvent<HTMLTextAreaElement>) {
    onCursorChange?.(cursorAt(event.currentTarget));
  }

  return (
    <div className="editor-pane">
      <div className="editor-gutter" ref={gutterRef} aria-hidden="true">
        {Array.from({ length: lineCount }, (_, index) => (
          <div key={index}>{index + 1}</div>
        ))}
      </div>

      <textarea
        ref={textareaRef}
        className="editor-input"
        aria-label="Paste Postgres migration"
        spellCheck={false}
        wrap="off"
        value={sql}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => syncScroll(event.currentTarget.scrollTop)}
        onSelect={reportCursor}
        onClick={reportCursor}
        onKeyUp={reportCursor}
      />

      <div className="editor-minimap" aria-hidden="true">
        {Array.from({ length: lineCount }, (_, index) => (
          <div key={index} className="minimap-bar" />
        ))}
      </div>
    </div>
  );
}
