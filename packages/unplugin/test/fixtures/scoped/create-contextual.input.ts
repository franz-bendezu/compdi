import { createScoped } from "@compdi/core";

interface RequestContext {
  id: string;
}

interface Database {
  query(sql: string): unknown;
  close(): Promise<void>;
}

declare const useRequest: () => RequestContext;
declare const createDatabase: () => Database;

export const [database, databaseScope] = createScoped({
  factory: createDatabase,
  deps: [],
  context: useRequest,
  onRelease: async (instance) => instance.close()
});
