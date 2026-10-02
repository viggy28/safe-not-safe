export const POSTGRES_VERSIONS = [15, 16, 17, 18] as const;

export type PostgresVersion = (typeof POSTGRES_VERSIONS)[number];

export const DEFAULT_POSTGRES_VERSION: PostgresVersion = 17;

export function isPostgresVersion(value: unknown): value is PostgresVersion {
  return typeof value === "number" && POSTGRES_VERSIONS.includes(value as PostgresVersion);
}
