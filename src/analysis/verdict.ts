import type { Analysis, Finding, ParsedMigration } from "@/src/analysis/types";

function noSqlAnalysis(migration: ParsedMigration): Analysis {
  return {
    verdict: "NO_INPUT",
    headline: "Waiting on SQL.",
    summary: "Paste a migration, or load one of the samples.",
    findings: [],
    diagnostics: migration.diagnostics,
    parser: migration.parser,
    statements: migration.statements,
  };
}

export function buildVerdict(migration: ParsedMigration, findings: Finding[]): Analysis {
  if (!migration.statements.length) {
    return noSqlAnalysis(migration);
  }

  const unsafe = findings.find((finding) => finding.severity === "unsafe");
  if (unsafe) {
    return {
      verdict: "NOT_SAFE",
      headline: unsafe.title,
      summary: unsafe.why,
      findings,
      decisiveFinding: unsafe,
      diagnostics: migration.diagnostics,
      parser: migration.parser,
      statements: migration.statements,
    };
  }

  const context = findings.find((finding) => finding.severity === "context" && finding.question);
  if (context?.question) {
    return {
      verdict: "NEEDS_CONTEXT",
      headline: "One answer decides this migration.",
      summary: context.why,
      findings,
      decisiveFinding: context,
      question: context.question,
      diagnostics: migration.diagnostics,
      parser: migration.parser,
      statements: migration.statements,
    };
  }

  const unsupported = findings.find((finding) => finding.severity === "unsupported");
  if (unsupported) {
    return {
      verdict: "UNSUPPORTED",
      headline: unsupported.title,
      summary: unsupported.why,
      findings,
      decisiveFinding: unsupported,
      diagnostics: migration.diagnostics,
      parser: migration.parser,
      statements: migration.statements,
    };
  }

  return {
    verdict: "SAFE",
    headline: "No blocking pattern found.",
    summary: "The checked statements avoid the common lock, rewrite, and rollout traps in the launch rule set.",
    findings,
    decisiveFinding: findings[0],
    diagnostics: migration.diagnostics,
    parser: migration.parser,
    statements: migration.statements,
  };
}
