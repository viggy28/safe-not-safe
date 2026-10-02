/// <reference types="vite/client" />

declare module "*.wasm?url" {
  const url: string;
  export default url;
}

declare module "*?worker" {
  const WorkerConstructor: {
    new (): Worker;
  };
  export default WorkerConstructor;
}

declare module "@pgsql-parser/v*-module" {
  type ModuleOptions = {
    locateFile?: (path: string) => string;
    wasmBinary?: ArrayBuffer | Uint8Array;
  };

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

  const createModule: (options?: ModuleOptions) => Promise<PgQueryWasmModule>;
  export default createModule;
}

declare module "@pgsql-parser/v*-wasm?url" {
  const url: string;
  export default url;
}
