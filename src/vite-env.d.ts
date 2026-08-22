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

declare module "@libpg-query/parser/wasm/libpg-query.js" {
  type ModuleOptions = {
    locateFile?: (path: string) => string;
    wasmBinary?: ArrayBuffer | Uint8Array;
  };

  const createModule: (options?: ModuleOptions) => Promise<unknown>;
  export default createModule;
}
