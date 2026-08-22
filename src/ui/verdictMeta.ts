import type { FindingSeverity, Verdict } from "@/src/analysis/types";

export type VerdictMeta = {
  label: string;
  /** Color used inside the dark terminal panel. */
  dark: string;
  /** Color used in the light chrome. */
  light: string;
  /** Soft background tint for the verdict banner. */
  soft: string;
};

export const verdictMeta: Record<Verdict, VerdictMeta> = {
  SAFE: { label: "SAFE", dark: "#3ddc97", light: "#1f8f6a", soft: "#e7f5ef" },
  NOT_SAFE: { label: "NOT SAFE", dark: "#ff6b6b", light: "#c0392f", soft: "#fdeceb" },
  NEEDS_CONTEXT: { label: "NEEDS CONTEXT", dark: "#f8c555", light: "#9a6f0a", soft: "#fdf4e0" },
  UNSUPPORTED: { label: "UNSUPPORTED", dark: "#c792ea", light: "#6d4e9e", soft: "#f2edf8" },
  NO_INPUT: { label: "NO INPUT", dark: "#7aa7ff", light: "#4b6bbf", soft: "#eef2fb" },
  CHECKING: { label: "CHECKING", dark: "#7aa7ff", light: "#4b6bbf", soft: "#eef2fb" },
  PARSER_ERROR: { label: "PARSER ERROR", dark: "#ff6b6b", light: "#c0392f", soft: "#fdeceb" },
};

export type SeverityMeta = {
  glyph: string;
  tag: string;
  dark: string;
  light: string;
  soft: string;
};

export const severityMeta: Record<FindingSeverity, SeverityMeta> = {
  safe: { glyph: "✓", tag: "SAFE", dark: "#3ddc97", light: "#1f8f6a", soft: "#e7f5ef" },
  unsafe: { glyph: "✕", tag: "NOT SAFE", dark: "#ff6b6b", light: "#c0392f", soft: "#fdeceb" },
  context: { glyph: "?", tag: "ASK", dark: "#f8c555", light: "#9a6f0a", soft: "#fdf4e0" },
  unsupported: { glyph: "!", tag: "UNSUPPORTED", dark: "#c792ea", light: "#6d4e9e", soft: "#f2edf8" },
};
