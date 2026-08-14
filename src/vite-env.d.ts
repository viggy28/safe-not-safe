declare module "*.wasm?url" {
  const url: string;
  export default url;
}

declare module "@libpg-query/parser/wasm/libpg-query.js" {
  type ModuleOptions = {
    locateFile?: (path: string) => string;
  };

  const createModule: (options?: ModuleOptions) => Promise<unknown>;
  export default createModule;
}
