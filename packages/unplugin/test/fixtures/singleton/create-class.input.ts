// Style: interfaces + explicit generics on all calls
import { createSingleton } from "@compdi/core";

interface IConfig {
  env: string;
  debug: boolean;
}

interface ILogger {
  log(msg: string): void;
}

interface IDatabase {
  query(sql: string): Promise<unknown>;
}

class Config implements IConfig {
  constructor(readonly env: string, readonly debug: boolean) {}
}

class Logger implements ILogger {
  constructor(readonly config: IConfig) {}
  log(msg: string) { console.log(msg); }
}

class Database implements IDatabase {
  constructor(readonly config: IConfig, readonly logger: ILogger) {}
  async query(sql: string): Promise<unknown> { return sql; }
}

export const config = createSingleton<IConfig>({ target: Config, deps: ["production", false] });
export const logger = createSingleton<ILogger>({ target: Logger, deps: [config] });
export const db = createSingleton<IDatabase>({ target: Database, deps: [config, logger] });
