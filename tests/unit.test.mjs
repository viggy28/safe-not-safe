import { mkdir } from "node:fs/promises";
import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = resolve(root, ".tmp/unit-tests.mjs");

await mkdir(dirname(outfile), { recursive: true });

await build({
  entryPoints: [resolve(root, "tests/unit-entry.ts")],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  external: ["@libpg-query/parser"],
  plugins: [
    {
      name: "workspace-alias",
      setup(buildContext) {
        buildContext.onResolve({ filter: /^@\/src\/parser\/browserLibpgQuery$/ }, () => ({
          path: "@/src/parser/browserLibpgQuery",
          external: true,
        }));
        buildContext.onResolve({ filter: /^@\// }, (args) => {
          const basePath = resolve(root, args.path.slice(2));
          const candidates = [
            basePath,
            `${basePath}.ts`,
            `${basePath}.tsx`,
            resolve(basePath, "index.ts"),
            resolve(basePath, "index.tsx"),
          ];
          const path =
            candidates.find((candidate) => {
              try {
                return statSync(candidate).isFile();
              } catch {
                return false;
              }
            }) ?? basePath;
          return { path };
        });
      },
    },
  ],
});

await import(pathToFileURL(outfile).href);
