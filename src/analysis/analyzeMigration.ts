import type { Analysis, Finding, MigrationContext, ParsedMigration } from "@/src/analysis/types";
import { buildVerdict } from "@/src/analysis/verdict";
import { parseSqlFallback } from "@/src/parser/fallbackParser";
import { rules } from "@/src/rules";

function fallbackSafeFinding(statement: ParsedMigration["statements"][number]): Finding {
  return {
    id: `no-rule-${statement.id}`,
    ruleId: "no-high-risk-pattern",
    title: "No high-risk pattern matched",
    statement: statement.compactSql,
    severity: "safe",
    why: "No launch-scope blocking, rewrite, or rollout risk matched this statement.",
  };
}

export function analyzeParsedMigration(
  migration: ParsedMigration,
  context: MigrationContext = {},
): Analysis {
  const findings = migration.statements.map((statement) => {
    for (const rule of rules) {
      const result = rule.evaluate(statement, migration, context);
      if (result) {
        return result;
      }
    }

    return fallbackSafeFinding(statement);
  });

  return buildVerdict(migration, findings);
}

export function analyzeMigrationFromText(sql: string, context: MigrationContext = {}): Analysis {
  return analyzeParsedMigration(parseSqlFallback(sql), context);
}

export function parseErrorAnalysis(sql: string, message: string): Analysis {
  return {
    verdict: "UNSUPPORTED",
    headline: "Postgres parser could not read this SQL.",
    summary: message,
    findings: [],
    diagnostics: [{ source: "libpg_query", message }],
    parser: "libpg_query",
  };
}
