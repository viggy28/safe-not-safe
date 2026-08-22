import type { ParsedMigration, ParsedStatement } from "@/src/analysis/types";
import { compactSql, indexName as inferredIndexName, tableFromAlter } from "@/src/parser/sqlText";

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | undefined {
  return value && typeof value === "object" ? (value as AnyRecord) : undefined;
}

function nodeName(node: unknown) {
  const record = asRecord(node);
  return record ? Object.keys(record)[0] : undefined;
}

function unwrap<T = AnyRecord>(node: unknown, key: string): T | undefined {
  return asRecord(node)?.[key] as T | undefined;
}

function relationName(relation: unknown) {
  const record = asRecord(relation);
  return typeof record?.relname === "string" ? record.relname : undefined;
}

function stringValue(node: unknown) {
  const value = unwrap<{ sval?: string }>(node, "String");
  return value?.sval;
}

function functionName(node: unknown) {
  const funcCall = unwrap<{ funcname?: unknown[] }>(node, "FuncCall");
  return funcCall?.funcname?.map(stringValue).filter(Boolean).join(".");
}

function isLiteralNode(node: unknown) {
  const name = nodeName(node);
  return name === "A_Const" || name === "TypeCast";
}

function hasExpressionDefault(columnDef: AnyRecord) {
  const constraints = Array.isArray(columnDef.constraints) ? columnDef.constraints : [];
  for (const item of constraints) {
    const constraint = unwrap<AnyRecord>(item, "Constraint");
    if (constraint?.contype !== "CONSTR_DEFAULT") {
      continue;
    }

    const rawExpr = constraint.raw_expr;
    const func = functionName(rawExpr);
    if (func) {
      return true;
    }

    return !isLiteralNode(rawExpr);
  }

  return false;
}

function hasDefault(columnDef: AnyRecord) {
  const constraints = Array.isArray(columnDef.constraints) ? columnDef.constraints : [];
  return constraints.some((item) => unwrap<AnyRecord>(item, "Constraint")?.contype === "CONSTR_DEFAULT");
}

function normalizeStatement(sql: string, stmtEnvelope: AnyRecord, index: number): ParsedStatement {
  const location = typeof stmtEnvelope.stmt_location === "number" ? stmtEnvelope.stmt_location : 0;
  const length = typeof stmtEnvelope.stmt_len === "number" ? stmtEnvelope.stmt_len : undefined;
  const rawSql = sql.slice(location, length ? location + length : undefined).replace(/;+\s*$/, "").trim();
  const compactSqlText = compactSql(rawSql);
  const stmt = asRecord(stmtEnvelope.stmt);
  const astType = stmt ? Object.keys(stmt)[0] : undefined;
  const base: ParsedStatement = {
    id: `pg-${index}-${location}-${length ?? 0}`,
    rawSql,
    compactSql: compactSqlText,
    kind: "unknown",
    astType,
    ast: stmtEnvelope.stmt,
    alterActions: [],
    line: sql.slice(0, location).split("\n").length,
  };

  const indexStmt = unwrap<AnyRecord>(stmt, "IndexStmt");
  if (indexStmt) {
    return {
      ...base,
      kind: "create_index",
      tableName: relationName(indexStmt.relation),
      indexName: typeof indexStmt.idxname === "string" ? indexStmt.idxname : inferredIndexName(compactSqlText),
      indexConcurrent: Boolean(indexStmt.concurrent),
      indexUnique: Boolean(indexStmt.unique),
    };
  }

  const alterTable = unwrap<AnyRecord>(stmt, "AlterTableStmt");
  if (alterTable) {
    const commands = Array.isArray(alterTable.cmds) ? alterTable.cmds : [];
    const normalized: ParsedStatement = {
      ...base,
      kind: "alter_table",
      tableName: relationName(alterTable.relation) ?? tableFromAlter(compactSqlText),
    };

    for (const commandNode of commands) {
      const command = unwrap<AnyRecord>(commandNode, "AlterTableCmd");
      if (!command) {
        continue;
      }

      switch (command.subtype) {
        case "AT_AddColumn": {
          normalized.alterActions.push("add_column");
          const columnDef = unwrap<AnyRecord>(command.def, "ColumnDef");
          normalized.hasDefault = columnDef ? hasDefault(columnDef) : normalized.hasDefault;
          normalized.hasExpressionDefault = columnDef
            ? hasExpressionDefault(columnDef)
            : normalized.hasExpressionDefault;
          break;
        }
        case "AT_AlterColumnType":
          normalized.alterActions.push("alter_column_type");
          break;
        case "AT_AddConstraint": {
          normalized.alterActions.push("add_constraint");
          const constraint = unwrap<AnyRecord>(command.def, "Constraint");
          if (constraint?.contype === "CONSTR_FOREIGN") {
            normalized.constraintType = "foreign_key";
            normalized.constraintValidatesImmediately = !constraint.skip_validation;
          } else if (constraint?.contype === "CONSTR_UNIQUE") {
            normalized.constraintType = "unique";
          } else {
            normalized.constraintType = "other";
          }
          break;
        }
        case "AT_ValidateConstraint":
          normalized.alterActions.push("validate_constraint");
          break;
        case "AT_SetNotNull":
          normalized.alterActions.push("set_not_null");
          break;
        case "AT_DropColumn":
          normalized.alterActions.push("drop_column");
          break;
        default:
          normalized.alterActions.push("unknown");
      }
    }

    return normalized;
  }

  if (unwrap(stmt, "TransactionStmt")) {
    return { ...base, kind: "transaction" };
  }

  if (unwrap(stmt, "TruncateStmt")) {
    return { ...base, kind: "truncate" };
  }

  if (unwrap(stmt, "RenameStmt")) {
    const renameStmt = unwrap<AnyRecord>(stmt, "RenameStmt");
    return {
      ...base,
      kind: "rename",
      tableName: relationName(renameStmt?.relation),
    };
  }

  if (astType === "ClusterStmt" || /^vacuum\s+full\b/i.test(compactSqlText)) {
    return { ...base, kind: "rewrite_command" };
  }

  return base;
}

export function normalizeLibpgQueryResult(sql: string, parseResult: unknown): ParsedMigration {
  const result = asRecord(parseResult);
  const stmts = Array.isArray(result?.stmts) ? result.stmts : [];

  return {
    sql,
    statements: stmts.map((stmt, index) => normalizeStatement(sql, stmt as AnyRecord, index)),
    parser: "libpg_query",
    diagnostics: [],
  };
}
