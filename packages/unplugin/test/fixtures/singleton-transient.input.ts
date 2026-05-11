import { createSingleton, defineTransient } from "@compdi/core";

class Database {}
class Service {
  constructor(readonly db: Database) {}
}

export const db = createSingleton(Database, []);
export const createService = defineTransient(Service, [db]);
