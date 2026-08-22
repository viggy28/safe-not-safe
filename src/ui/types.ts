export type PanelTab = "problems" | "terminal" | "output" | "ast" | "rules";

export type Buffer = {
  id: number;
  name: string;
  sql: string;
};

export type Cursor = {
  line: number;
  col: number;
};
