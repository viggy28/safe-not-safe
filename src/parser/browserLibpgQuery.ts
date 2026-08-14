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

function stringToPtr(module: PgQueryWasmModule, value: string) {
  const length = module.lengthBytesUTF8(value) + 1;
  const ptr = module._malloc(length);

  try {
    module.stringToUTF8(value, ptr, length);
    return ptr;
  } catch (error) {
    module._free(ptr);
    throw error;
  }
}

export async function parseSqlInBrowserWithWasmAsset(query: string) {
  if (!query.trim()) {
    return { version: 170004, stmts: [] };
  }

  const module = await getModule();
  const queryPtr = stringToPtr(module, query);
  let resultPtr = 0;

  try {
    resultPtr = module._wasm_parse_query_raw(queryPtr);
    if (!resultPtr) {
      throw new Error("Failed to parse query: memory allocation failed");
    }

    const parseTreePtr = module.getValue(resultPtr, "i32");
    const errorPtr = module.getValue(resultPtr + 8, "i32");

    if (errorPtr) {
      const messagePtr = module.getValue(errorPtr, "i32");
      throw new Error(messagePtr ? module.UTF8ToString(messagePtr) : "Unknown parser error");
    }

    if (!parseTreePtr) {
      throw new Error("No parse tree generated");
    }

    return JSON.parse(module.UTF8ToString(parseTreePtr));
  } finally {
    module._free(queryPtr);
    if (resultPtr) {
      module._wasm_free_parse_result(resultPtr);
    }
  }
}
