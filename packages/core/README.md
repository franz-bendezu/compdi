# @compdi/core

Type-safe macro API for Compdi dependency injection.

## Install

```bash
npm install @compdi/core
```

## What this package provides

This package exports macro signatures used by the Compdi compiler plugin.

Naming rule:

- `create...` macros export realized values or instances.
- `define...` macros export functions or providers.

- `createSingleton(Target, deps)`
- `defineSingleton(Target, deps)`
- `defineTransient(Target, deps)`
- `createLazySingleton(Target, deps)`
- `defineLazySingleton(Target, deps)`
- `createAsyncSingleton(factory, deps)`
- `defineAsyncSingleton(factory, deps)`
- `defineAppTeardown(resources)`

## Usage

```ts
import {
  createSingleton,
  defineSingleton,
  defineTransient,
  createLazySingleton,
  defineLazySingleton,
  createAsyncSingleton,
  defineAsyncSingleton,
} from "@compdi/core";

class Database {}
class Service {
  constructor(private readonly db: Database) {}
}

const db = createSingleton(Database, []);
const useDb = defineSingleton(Database, []);
const createService = defineTransient(Service, [db]);
const analytics = createLazySingleton(Service, [db]);
const useAnalytics = defineLazySingleton(Service, [db]);
const connection = createAsyncSingleton(async (db: Database) => db, [db]);
const useConnection = defineAsyncSingleton(async (db: Database) => db, [db]);
```

## Important runtime note

These APIs are compile-time macros. They must be transformed by the Compdi plugin during build.
If macro calls reach runtime without transformation, they throw by design.

## License

MIT
