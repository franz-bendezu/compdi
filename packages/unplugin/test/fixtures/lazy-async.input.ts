import { createSingleton, createLazySingleton, defineAsyncSingleton } from "@compdi/core";

interface IDatabase {
  query(sql: string): Promise<any>;
}

class Database implements IDatabase {
  constructor(readonly connectionString: string) { }

  async query(sql: string): Promise<any> {
    return `executed:${sql}`;
  }
}

class Analytics {
  constructor(readonly db: Database) { }
}

class SecretManager {
  async getSecret(name: string): Promise<string> {
    return `resolved:${name}`;
  }
}

async function loadConnectionString(): Promise<string> {
  return "postgres://compdi.test/app";
}

async function createDatabase(sm: SecretManager): Promise<IDatabase> {
  const secretName = await loadConnectionString();
  const connectionString = await sm.getSecret(secretName);
  return new Database(connectionString);
}

export const db = createSingleton(Database, ["postgres://compdi.test/primary"]);
export const secretManager = createSingleton(SecretManager, []);
export const analytics = createLazySingleton(Analytics, [db]);
export const useDatabase = defineAsyncSingleton(createDatabase, [secretManager]);

export async function app() {
  const asyncDatabase: IDatabase = await useDatabase();

  return {
    db,
    secretManager,
    analytics,
    asyncDatabase
  };
}
