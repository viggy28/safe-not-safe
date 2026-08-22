"use client";

import { useState } from "react";

const SCALAR_WRAPPERS: Record<string, string> = {
  String: "sval",
  Integer: "ival",
  Boolean: "boolval",
  Float: "fval",
};

type Obj = Record<string, unknown>;

function asObject(value: unknown): Obj | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : null;
}

function nodeType(value: unknown): string | null {
  const obj = asObject(value);
  if (!obj) {
    return null;
  }
  const keys = Object.keys(obj);
  return keys.length === 1 ? keys[0] : null;
}

function unwrapScalar(value: unknown): { done: boolean; value: unknown } {
  const type = nodeType(value);
  if (type && type in SCALAR_WRAPPERS) {
    const body = asObject(value)?.[type];
    const inner = asObject(body);
    return { done: true, value: inner ? inner[SCALAR_WRAPPERS[type]] : body };
  }
  return { done: false, value };
}

function Leaf({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="ast-null">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className={value ? "ast-true" : "ast-false"}>{String(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="ast-number">{value}</span>;
  }
  if (typeof value === "string") {
    return <span className="ast-string">{value}</span>;
  }
  return <span className="ast-string">{String(value)}</span>;
}

function AstChildren({ body, depth }: { body: unknown; depth: number }) {
  if (Array.isArray(body)) {
    return (
      <div className="ast-children">
        {body.map((item, index) => (
          <div key={index} className="ast-row">
            <span className="ast-key">[{index}]</span>
            <AstValue value={item} depth={depth} />
          </div>
        ))}
      </div>
    );
  }

  const obj = asObject(body);
  if (obj) {
    return (
      <div className="ast-children">
        {Object.entries(obj).map(([key, value]) => (
          <div key={key} className="ast-row">
            <span className="ast-key">{key}</span>
            <AstValue value={value} depth={depth} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="ast-children">
      <Leaf value={body} />
    </div>
  );
}

function AstObject({ value, depth }: { value: unknown; depth: number }) {
  const [open, setOpen] = useState(depth <= 1);
  const type = nodeType(value);
  const obj = asObject(value);

  if (!type || !obj) {
    return <Leaf value={value} />;
  }

  return (
    <span className="ast-object">
      <button type="button" className="ast-toggle" onClick={() => setOpen((current) => !current)}>
        <span className="ast-caret">{open ? "▾" : "▸"}</span>
        {type}
      </button>
      {open ? <AstChildren body={obj[type]} depth={depth + 1} /> : null}
    </span>
  );
}

function AstArray({ items, depth }: { items: unknown[]; depth: number }) {
  const [open, setOpen] = useState(depth <= 1);

  return (
    <span className="ast-object">
      <button type="button" className="ast-toggle" onClick={() => setOpen((current) => !current)}>
        <span className="ast-caret">{open ? "▾" : "▸"}</span>
        [{items.length}]
      </button>
      {open ? <AstChildren body={items} depth={depth + 1} /> : null}
    </span>
  );
}

function AstValue({ value, depth }: { value: unknown; depth: number }) {
  if (Array.isArray(value)) {
    return <AstArray items={value} depth={depth} />;
  }

  const scalar = unwrapScalar(value);
  if (scalar.done) {
    if (Array.isArray(scalar.value)) {
      return <AstArray items={scalar.value} depth={depth} />;
    }
    if (asObject(scalar.value)) {
      return <AstObject value={scalar.value} depth={depth} />;
    }
    return <Leaf value={scalar.value} />;
  }

  if (asObject(value)) {
    return <AstObject value={value} depth={depth} />;
  }

  return <Leaf value={value} />;
}

export function AstBody({ ast }: { ast: unknown }) {
  const obj = asObject(ast);
  const type = obj ? Object.keys(obj)[0] : undefined;
  const body = type ? obj?.[type] : ast;

  if (!type) {
    return <div className="ast-empty">No parse tree for this statement.</div>;
  }

  return <AstChildren body={body} depth={0} />;
}

export function AstTypeName({ ast }: { ast: unknown }) {
  const obj = asObject(ast);
  return <>{obj ? (Object.keys(obj)[0] ?? "RawStmt") : "RawStmt"}</>;
}
