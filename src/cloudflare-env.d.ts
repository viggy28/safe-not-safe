declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
  };
}

interface D1Database {
  prepare(query: string): unknown;
  batch<T = unknown>(statements: unknown[]): Promise<T[]>;
  dump(): Promise<ArrayBuffer>;
  exec(query: string): Promise<unknown>;
}

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}
