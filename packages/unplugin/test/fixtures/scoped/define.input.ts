// Style: interfaces only for scoped contracts, explicit generics on defineScoped with context key type
import { createSingleton, defineScoped } from "@compdi/core";

interface IRequestContext {
  traceId: string;
}

interface ISessionStore {
  get(key: string): unknown;
}

class Config {
  constructor(readonly env: string) {}
}

class Logger {
  constructor(readonly config: Config) {}
  log(msg: string) { console.log(msg); }
}

class RequestContext implements IRequestContext {
  constructor(readonly config: Config, readonly logger: Logger, readonly traceId: string) {}
}

class SessionStore implements ISessionStore {
  constructor(readonly config: Config) {}
  get(key: string) { return key; }
}

export const config = createSingleton<Config>({ target: Config, deps: ["production"] });
export const logger = createSingleton<Logger>({ target: Logger, deps: [config] });

interface RequestCtx { requestId: string; }
interface SessionCtx { sessionId: string; }

export const getRequestContext = defineScoped<IRequestContext, RequestCtx>({ target: RequestContext, deps: [config, logger, "trace-001"] });
export const getSession = defineScoped<ISessionStore, SessionCtx>({ target: SessionStore, deps: [config] });

export const session: ISessionStore = getSession({ sessionId: "abc" });