import {
  defineAppTeardown,
  defineAsyncSingleton,
  defineLazySingleton,
  defineSingleton,
  defineTransient
} from "@compdi/core";

class Database {
  public connected = true;

  public query(sql: string): string {
    return `query(${sql})`;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    this.connected = false;
  }
}

class Logger {
  public info(message: string): string {
    return `logger:${message}`;
  }
}

class Service {
  constructor(
    private readonly db: Database,
    private readonly logger: Logger
  ) {}

  run(): string {
    return this.logger.info(this.db.query("SELECT 1"));
  }
}

class Analytics {
  constructor(private readonly db: Database) {}

  ping(): string {
    return this.db.query("SELECT analytics");
  }
}

export const db = defineSingleton(Database, []);
export const logger = defineSingleton(Logger, []);
export const createService = defineTransient(Service, [db, logger]);
export const analytics = defineLazySingleton(Analytics, [db]);

export const connection = defineAsyncSingleton(async () => {
  const c = new Database();
  return c;
}, []);

export const teardown = defineAppTeardown([db, logger]);

const app = document.querySelector("#app");
if (app) {
  const service = createService();
  app.innerHTML = `
    <pre>${service.run()}</pre>
    <pre>${analytics.ping()}</pre>
  `;
}
