// Style: plain classes, explicit generic only on createTransient
import { createSingleton, createTransient } from "@compdi/core";

class Config {
  constructor(readonly env: string) {}
}

class Logger {
  constructor(readonly config: Config) {}
  log(msg: string) { console.log(msg); }
}

class RequestHandler {
  constructor(
    readonly config: Config,
    readonly logger: Logger,
    readonly requestId: string
  ) {}
  handle() { this.logger.log(this.requestId); }
}

export const config = createSingleton({ target: Config, deps: ["production"] });
export const logger = createSingleton({ target: Logger, deps: [config] });
export const handler = createTransient<RequestHandler>({ target: RequestHandler, deps: [config, logger, "req-001"] });
