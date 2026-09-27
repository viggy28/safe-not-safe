import assert from "node:assert/strict";
import test from "node:test";
import { analyzeParsedMigration } from "../src/analysis/analyzeMigration";
import { parseSqlWithLibpgQuery } from "../src/parser/parseWithLibpgQuery";

async function analyze(sql: string, context = {}) {
  return analyzeParsedMigration(await parseSqlWithLibpgQuery(sql), context);
}

test("libpg_query keeps dollar-quoted function bodies as one statement", async () => {
  const parsed = await parseSqlWithLibpgQuery(`
    CREATE FUNCTION touch_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  assert.equal(parsed.parser, "libpg_query");
  assert.equal(parsed.statements.length, 1);
});

test("regular create index is not safe, concurrent index is safe", async () => {
  const blocking = await analyze("CREATE INDEX users_email_idx ON users (email);");
  assert.equal(blocking.verdict, "NOT_SAFE");
  assert.equal(blocking.decisiveFinding?.ruleId, "create-index-without-concurrently");

  const concurrent = await analyze("CREATE INDEX CONCURRENTLY users_email_idx ON users (email);");
  assert.equal(concurrent.verdict, "SAFE");
  assert.equal(concurrent.findings[0]?.ruleId, "create-index-concurrently");
});

test("concurrent index inside transaction is not safe", async () => {
  const result = await analyze(`
    BEGIN;
    CREATE INDEX CONCURRENTLY users_email_idx ON users (email);
    COMMIT;
  `);

  assert.equal(result.verdict, "NOT_SAFE");
  assert.equal(result.decisiveFinding?.ruleId, "concurrently-inside-transaction");
});

test("new NOT NULL column without a default requires an empty table", async () => {
  const sql = "ALTER TABLE users ADD COLUMN status text NOT NULL;";

  const unknown = await analyze(sql);
  assert.equal(unknown.verdict, "NEEDS_CONTEXT");
  assert.equal(unknown.decisiveFinding?.ruleId, "add-column-not-null-without-default");
  assert.equal(unknown.question?.id, "table-size");

  const empty = await analyze(sql, { tableSize: "empty" });
  assert.equal(empty.verdict, "SAFE");
  assert.equal(empty.findings[0]?.ruleId, "add-column-not-null-without-default");

  const nonEmpty = await analyze(sql, { tableSize: "small" });
  assert.equal(nonEmpty.verdict, "NOT_SAFE");
  assert.equal(nonEmpty.decisiveFinding?.ruleId, "add-column-not-null-without-default");

  const mixedColumns = await analyze(
    "ALTER TABLE users ADD COLUMN role text DEFAULT 'member', ADD COLUMN status text NOT NULL;",
  );
  assert.equal(mixedColumns.verdict, "NEEDS_CONTEXT");
  assert.equal(mixedColumns.decisiveFinding?.ruleId, "add-column-not-null-without-default");
});

test("new NOT NULL column with a constant default remains safe", async () => {
  const result = await analyze("ALTER TABLE users ADD COLUMN status text NOT NULL DEFAULT 'active';");

  assert.equal(result.verdict, "SAFE");
  assert.equal(result.findings[0]?.ruleId, "add-column-constant-default");
});

test("foreign key validation asks for table size before deciding", async () => {
  const sql = `
    ALTER TABLE orders
      ADD CONSTRAINT orders_user_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id);
  `;

  const unknown = await analyze(sql);
  assert.equal(unknown.verdict, "NEEDS_CONTEXT");
  assert.equal(unknown.question?.id, "table-size");

  const large = await analyze(sql, { tableSize: "large" });
  assert.equal(large.verdict, "NOT_SAFE");

  const small = await analyze(sql, { tableSize: "small" });
  assert.equal(small.verdict, "SAFE");
});

