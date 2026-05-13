// Style: interfaces with dispose symbols, no generics on macro calls (inferred)
import { createSingleton, defineSingleton, defineAppTeardown } from "@compdi/core";

interface IDatabase {
  query(sql: string): Promise<unknown>;
  [Symbol.dispose](): void;
}

interface ICacheClient {
  get(key: string): unknown;
  [Symbol.dispose](): void;
}

interface IConnection {
  [Symbol.asyncDispose](): Promise<void>;
}

class Database implements IDatabase {
  async query(sql: string): Promise<unknown> { return sql; }
  [Symbol.dispose]() {}
}

class CacheClient implements ICacheClient {
  get(key: string) { return key; }
  [Symbol.dispose]() {}
}

async function openConnection(): Promise<IConnection> {
  return {
    async [Symbol.asyncDispose]() {}
  };
}

export const db = createSingleton({ target: Database, deps: [] });
export const useConnection = defineSingleton({ factory: openConnection, deps: [] });
export const useCacheClient = defineSingleton({ target: CacheClient, deps: [], lazy: true });
export const teardown = defineAppTeardown([db, useConnection, useCacheClient]);
