import type { Analysis, Finding, ParsedMigration } from "@/src/analysis/types";

function analysisSource(migration: ParsedMigration) {
  return {
    diagnostics: migration.diagnostics,
    parser: migration.parser,
    postgresVersion: migration.postgresVersion,
    statements: migration.statements,
  };
}

function noSqlAnalysis(migration: ParsedMigration): Analysis {
  return {
    verdict: "NO_INPUT",
    headline: "Waiting on SQL.",
    summary: "Paste a migration, or load one of the samples.",
    findings: [],
    ...analysisSource(migration),
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
      ...analysisSource(migration),
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
      ...analysisSource(migration),
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
      ...analysisSource(migration),
    };
  }

  return {
    verdict: "SAFE",
    headline: "No blocking pattern found.",
    summary: "The checked statements avoid the common lock, rewrite, and rollout traps in the launch rule set.",
    findings,
    decisiveFinding: findings[0],
    ...analysisSource(migration),
  };
}
