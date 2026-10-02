import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  const parserAliases = [15, 16, 17, 18].flatMap((version) => {
    const parserRoot = fileURLToPath(
      new URL(`./node_modules/@pgsql/parser/wasm/v${version}/`, import.meta.url),
    );

    return [
      {
        find: `@pgsql-parser/v${version}-module`,
        replacement: `${parserRoot}libpg-query.js`,
      },
      {
        find: `@pgsql-parser/v${version}-wasm?url`,
        replacement: `${parserRoot}libpg-query.wasm?url`,
      },
    ];
  });

  return {
    resolve: { alias: parserAliases },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      }),
    ],
  };
});
