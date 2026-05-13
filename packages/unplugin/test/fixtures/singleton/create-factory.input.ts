// Style: plain classes, no interfaces, no explicit generics (fully inferred)
import { createSingleton } from "@compdi/core";

class Config {
  constructor(readonly dsn: string) {}
}

function createCache(config: Config, ttl: number) {
  return { dsn: config.dsn, ttl };
}

export const config = createSingleton({ target: Config, deps: ["redis://localhost"] });
export const cache = createSingleton({ factory: createCache, deps: [config, 300] });
