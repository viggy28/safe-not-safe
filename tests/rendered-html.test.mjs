import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the developer migration checker", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Is my migration safe\?<\/title>/i);
  assert.match(html, /Your SQL never leaves the browser/);
  assert.match(html, /No API route/);
  assert.match(html, /migration\.sql/);
  assert.match(html, /CHECKING/);
  assert.match(html, /Loading PostgreSQL parser/);
  assert.match(html, /libpg_query/);
  assert.doesNotMatch(html, /text fallback|fast fallback/i);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/i);
  assert.doesNotMatch(html, /localhost:3000\/og\.png/i);
});

test("client bundle emits a browser worker and WASM without fallback code", async () => {
  const staticUrl = new URL("../dist/client/_next/static/", import.meta.url);
  const assets = await readdir(staticUrl);
  assert.ok(assets.some((name) => /^parserWorker-.*\.js$/.test(name)));
  assert.ok(assets.some((name) => /^libpg-query-.*\.wasm$/.test(name)));

  const chunksUrl = new URL("chunks/", staticUrl);
  const chunks = (await readdir(chunksUrl)).filter((name) => name.endsWith(".js"));
  const source = (
    await Promise.all(chunks.map((name) => readFile(new URL(name, chunksUrl), "utf8")))
  ).join("\n");

  assert.match(source, /parserWorker-[\w-]+\.js/);
  assert.doesNotMatch(source, /file:\/\/\/ROOT/);
  assert.doesNotMatch(source, /Using lightweight text classification|text fallback|fast fallback/i);
});
