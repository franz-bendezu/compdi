// Style: interfaces only on handler types, no generics at all (fully inferred)
import { createSingleton, defineTransient } from "@compdi/core";

interface IRequestHandler {
  handle(): void;
}

interface IAuditHandler {
  audit(action: string): void;
}

class Config {
  constructor(readonly env: string) {}
}

class Logger {
  constructor(readonly config: Config) {}
  log(msg: string) { console.log(msg); }
}

class RequestHandler implements IRequestHandler {
  constructor(readonly config: Config, readonly logger: Logger) {}
  handle() { this.logger.log("handled"); }
}

class AuditHandler implements IAuditHandler {
  constructor(readonly config: Config, readonly logger: Logger) {}
  audit(action: string) { this.logger.log(action); }
}

export const config = createSingleton({ target: Config, deps: ["production"] });
export const logger = createSingleton({ target: Logger, deps: [config] });
export const createRequestHandler = defineTransient({ target: RequestHandler, deps: [config, logger] });
export const createAuditHandler = defineTransient({ target: AuditHandler, deps: [config, logger] });
