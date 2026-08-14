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

function getModule() {
  modulePromise ??= PgQueryModule({
    locateFile(path: string) {
      return path.endsWith(".wasm") ? wasmUrl : path;
    },
  }) as Promise<PgQueryWasmModule>;

  return modulePromise;
}

function stringToPtr(wasmModule: PgQueryWasmModule, value: string) {
  const length = wasmModule.lengthBytesUTF8(value) + 1;
  const ptr = wasmModule._malloc(length);

  try {
    wasmModule.stringToUTF8(value, ptr, length);
    return ptr;
  } catch (error) {
    wasmModule._free(ptr);
    throw error;
  }
}

export async function parseSqlInBrowserWithWasmAsset(query: string) {
  if (!query.trim()) {
    return { version: 170004, stmts: [] };
  }

  const wasmModule = await getModule();
  const queryPtr = stringToPtr(wasmModule, query);
  let resultPtr = 0;

  try {
    resultPtr = wasmModule._wasm_parse_query_raw(queryPtr);
    if (!resultPtr) {
      throw new Error("Failed to parse query: memory allocation failed");
    }

    const parseTreePtr = wasmModule.getValue(resultPtr, "i32");
    const errorPtr = wasmModule.getValue(resultPtr + 8, "i32");

    if (errorPtr) {
      const messagePtr = wasmModule.getValue(errorPtr, "i32");
      throw new Error(messagePtr ? wasmModule.UTF8ToString(messagePtr) : "Unknown parser error");
    }

    if (!parseTreePtr) {
      throw new Error("No parse tree generated");
    }

    return JSON.parse(wasmModule.UTF8ToString(parseTreePtr));
  } finally {
    wasmModule._free(queryPtr);
    if (resultPtr) {
      wasmModule._wasm_free_parse_result(resultPtr);
    }
  }
}
