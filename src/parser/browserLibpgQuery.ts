import PgQueryModule from "@libpg-query/parser/wasm/libpg-query.js";
import wasmUrl from "@libpg-query/parser/wasm/libpg-query.wasm?url";

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

let modulePromise: Promise<PgQueryWasmModule> | undefined;

async function loadModule() {
  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(`Failed to load PostgreSQL parser WASM (${response.status})`);
  }

  // Passing the already-fetched binary prevents Emscripten from issuing a
  // second request when a host serves .wasm with a generic MIME type.
  const wasmBinary = await response.arrayBuffer();
  return PgQueryModule({
    wasmBinary,
    locateFile(path: string) {
      return path.endsWith(".wasm") ? wasmUrl : path;
    },
  }) as Promise<PgQueryWasmModule>;
}

function getModule() {
  modulePromise ??= loadModule();
  return modulePromise;
}

/** Start downloading and compiling the WASM module before the first query. */
export async function initializeBrowserLibpgQuery(): Promise<void> {
  await getModule();
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

export async function parseSqlInBrowserWithWasmAsset(query: string) {
  if (!query.trim()) {
    return { version: 170004, stmts: [] };
  }

  const wasm = await getModule();
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
