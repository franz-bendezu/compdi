import { createSingleton, defineAsyncSingleton, defineAppTeardown } from "@compdi/core";

class Database {
  [Symbol.dispose]() {}
}

async function openRemoteConnection() {
  return {
    async [Symbol.asyncDispose]() {}
  };
}

export const db = createSingleton(Database, []);
export const useRemote = defineAsyncSingleton(async () => {
  return openRemoteConnection();
}, []);
export const teardown = defineAppTeardown([db, useRemote]);

export async function app() {
  const remote = await useRemote();

  return {
    db,
    remote,
    teardown
  };
}
