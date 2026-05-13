// Style: type aliases, explicit generic only on defineSingleton (the factory return)
import { createSingleton, defineSingleton } from "@compdi/core";

type AppConfig = { dsn: string };
type AppLogger = { log(msg: string): void };
type DbConnection = { dsn: string; connected: boolean };

class Config {
  constructor(readonly dsn: string) {}
}

class Logger {
  constructor(readonly config: AppConfig) {}
  log(msg: string) { console.log(msg); }
}

async function openConnection(config: AppConfig, logger: AppLogger): Promise<DbConnection> {
  return { dsn: config.dsn, connected: true };
}

export const config = createSingleton({ target: Config, deps: ["postgres://localhost/app"] });
export const logger = createSingleton({ target: Logger, deps: [config] });
export const useConnection = defineSingleton<DbConnection>({ factory: openConnection, deps: [config, logger] });
