import { createSingleton, defineAsyncSingleton, defineAppTeardown } from "@compdi/core";

class Database {
  [Symbol.dispose]() {}
}

export const db = createSingleton(Database, []);
export const useRemote = defineAsyncSingleton(async () => ({
  async [Symbol.asyncDispose]() {}
}), []);
export const teardown = defineAppTeardown([db, useRemote]);

export async function app() {
  const remote = await useRemote();

  return {
    db,
    remote,
    teardown
  };
}
