import { createSingleton, createLazySingleton, defineAsyncSingleton } from "@compdi/core";

class Database {
  constructor(readonly connectionString: string) {}
}

class Analytics {
  constructor(readonly db: Database) {}
}

class SecretManager {
  async getSecret(name: string): Promise<string> {
    return `resolved:${name}`;
  }
}

async function loadConnectionString(): Promise<string> {
  return "postgres://compdi.test/app";
}

async function createDatabase(sm: SecretManager): Promise<Database> {
  const secretName = await loadConnectionString();
  const connectionString = await sm.getSecret(secretName);
  return new Database(connectionString);
}

export const db = createSingleton(Database, ["postgres://compdi.test/primary"]);
export const secretManager = createSingleton(SecretManager, []);
export const analytics = createLazySingleton(Analytics, [db]);
export const useDatabase = defineAsyncSingleton(createDatabase, [secretManager]);

export async function app() {
  const asyncDatabase = await useDatabase();

  return {
    db,
    secretManager,
    analytics,
    asyncDatabase
  };
}
