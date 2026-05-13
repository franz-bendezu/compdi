// Style: interfaces on classes, no explicit generics (inferred from target)
import { createSingleton, defineSingleton } from "@compdi/core";

interface IConfig {
  env: string;
}

interface ILogger {
  log(msg: string): void;
}

interface IUserRepository {
  findById(id: string): unknown;
}

interface IUserService {
  getUser(id: string): unknown;
}

class Config implements IConfig {
  constructor(readonly env: string) {}
}

class Logger implements ILogger {
  constructor(readonly config: IConfig) {}
  log(msg: string) { console.log(msg); }
}

class UserRepository implements IUserRepository {
  constructor(readonly config: IConfig, readonly logger: ILogger) {}
  findById(id: string) { return { id }; }
}

class UserService implements IUserService {
  constructor(readonly repo: IUserRepository, readonly logger: ILogger) {}
  getUser(id: string) { return this.repo.findById(id); }
}

export const config = createSingleton({ target: Config, deps: ["production"] });
export const logger = createSingleton({ target: Logger, deps: [config] });
export const userRepo = createSingleton({ target: UserRepository, deps: [config, logger] });
export const useUserService = defineSingleton({ target: UserService, deps: [userRepo, logger] });
