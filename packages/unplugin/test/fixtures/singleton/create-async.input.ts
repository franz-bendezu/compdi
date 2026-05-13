// Style: explicit generic only on the awaited call, dependency inferred
import { createSingleton } from "@compdi/core";

interface IDatabase {
  url: string;
}

class SecretManager {
  async getSecret(name: string) {
    return `secret:${name}`;
  }
}

async function createDatabase(sm: SecretManager): Promise<IDatabase> {
  const url = await sm.getSecret("db-url");
  return { url };
}

export const secretManager = createSingleton({ target: SecretManager, deps: [] });
export const db = await createSingleton<IDatabase>({ factory: createDatabase, deps: [secretManager] });
