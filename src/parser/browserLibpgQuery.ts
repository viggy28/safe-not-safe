import type { PostgresVersion } from "@/src/parser/postgresVersion";

type PgQueryWasmModule = {
  _free(ptr: number): void;
  _malloc(size: number): number;
  _wasm_free_parse_result(ptr: number): void;
  _wasm_parse_query_raw(ptr: number): number;
  getValue(ptr: number, type: string): number;
  lengthBytesUTF8(value: string): number;
  stringToUTF8(value: string, ptr: number, length: number): void;
  UTF8ToString(ptr: number): string;
};

type PgQueryModuleFactory = (options?: {
  wasmBinary?: ArrayBuffer | Uint8Array;
  locateFile?: (path: string) => string;
}) => Promise<PgQueryWasmModule>;

type ParserAsset = {
  createModule: PgQueryModuleFactory;
  wasmUrl: string;
};

const assetLoaders: Record<PostgresVersion, () => Promise<ParserAsset>> = {
  15: async () => {
    const [{ default: createModule }, { default: wasmUrl }] = await Promise.all([
      import("@pgsql-parser/v15-module"),
      import("@pgsql-parser/v15-wasm?url"),
    ]);
    return { createModule, wasmUrl };
  },
  16: async () => {
    const [{ default: createModule }, { default: wasmUrl }] = await Promise.all([
      import("@pgsql-parser/v16-module"),
      import("@pgsql-parser/v16-wasm?url"),
    ]);
    return { createModule, wasmUrl };
  },
  17: async () => {
    const [{ default: createModule }, { default: wasmUrl }] = await Promise.all([
      import("@pgsql-parser/v17-module"),
      import("@pgsql-parser/v17-wasm?url"),
    ]);
    return { createModule, wasmUrl };
  },
  18: async () => {
    const [{ default: createModule }, { default: wasmUrl }] = await Promise.all([
      import("@pgsql-parser/v18-module"),
      import("@pgsql-parser/v18-wasm?url"),
    ]);
    return { createModule, wasmUrl };
  },
};

const modulePromises = new Map<PostgresVersion, Promise<PgQueryWasmModule>>();

async function loadModule(version: PostgresVersion) {
  const { createModule, wasmUrl } = await assetLoaders[version]();
  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(`Failed to load PostgreSQL ${version} parser WASM (${response.status})`);
  }

  const wasmBinary = await response.arrayBuffer();
  return createModule({
    wasmBinary,
    locateFile(path) {
      return path.endsWith(".wasm") ? wasmUrl : path;
    },
  });
}

function getModule(version: PostgresVersion) {
  let modulePromise = modulePromises.get(version);
  if (!modulePromise) {
    modulePromise = loadModule(version).catch((error) => {
      modulePromises.delete(version);
      throw error;
    });
    modulePromises.set(version, modulePromise);
  }
  return modulePromise;
}

/** Start downloading and compiling the selected libpg_query WASM module. */
export async function initializeBrowserLibpgQuery(version: PostgresVersion): Promise<void> {
  await getModule(version);
}

function stringToPtr(wasm: PgQueryWasmModule, value: string) {
  const length = wasm.lengthBytesUTF8(value) + 1;
  const ptr = wasm._malloc(length);

  try {
    wasm.stringToUTF8(value, ptr, length);
    return ptr;
  } catch (error) {
    wasm._free(ptr);
    throw error;
  }
}

export async function parseSqlInBrowserWithWasmAsset(query: string, version: PostgresVersion) {
  if (!query.trim()) {
    return { version: version * 10_000, stmts: [] };
  }

  const wasm = await getModule(version);
  const queryPtr = stringToPtr(wasm, query);
  let resultPtr = 0;

  try {
    resultPtr = wasm._wasm_parse_query_raw(queryPtr);
    if (!resultPtr) {
      throw new Error("Failed to parse query: memory allocation failed");
    }

    const parseTreePtr = wasm.getValue(resultPtr, "i32");
    const errorPtr = wasm.getValue(resultPtr + 8, "i32");

    if (errorPtr) {
      const messagePtr = wasm.getValue(errorPtr, "i32");
      throw new Error(messagePtr ? wasm.UTF8ToString(messagePtr) : "Unknown parser error");
    }

    if (!parseTreePtr) {
      throw new Error("No parse tree generated");
    }

    return JSON.parse(wasm.UTF8ToString(parseTreePtr));
  } finally {
    wasm._free(queryPtr);
    if (resultPtr) {
      wasm._wasm_free_parse_result(resultPtr);
    }
  }
}
