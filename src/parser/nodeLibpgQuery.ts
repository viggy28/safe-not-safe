import type { PostgresVersion } from "@/src/parser/postgresVersion";

type ParserModule = {
  parse(sql: string): Promise<unknown>;
};

export async function parseSqlInNode(sql: string, version: PostgresVersion) {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  let parser: ParserModule;

  switch (version) {
    case 15:
      parser = require("@pgsql/parser/v15") as ParserModule;
      break;
    case 16:
      parser = require("@pgsql/parser/v16") as ParserModule;
      break;
    case 17:
      parser = require("@pgsql/parser/v17") as ParserModule;
      break;
    case 18:
      parser = require("@pgsql/parser/v18") as ParserModule;
      break;
  }

  return parser.parse(sql);
}
