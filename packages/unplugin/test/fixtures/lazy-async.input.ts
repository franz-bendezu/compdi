import { createSingleton, createLazySingleton, defineAsyncSingleton } from "@compdi/core";

class Database {}
class Analytics {
  constructor(readonly db: Database) {}
}

export const db = createSingleton(Database, []);
export const analytics = createLazySingleton(Analytics, [db]);
export const useDatabase = defineAsyncSingleton(async () => new Database(), []);
