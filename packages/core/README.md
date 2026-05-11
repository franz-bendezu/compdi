# @compdi/core

Type-safe macro API for Compdi dependency injection.

## Installation

```bash
npm install @compdi/core
```

## API

This package exports the macro signatures consumed by the Compdi build transform.

- `createSingleton(Target, deps)`
- `defineSingleton(Target, deps)`
- `defineTransient(Target, deps)`
- `createLazySingleton(Target, deps)`
- `defineLazySingleton(Target, deps)`
- `createAsyncSingleton(factory, deps)`
- `defineAsyncSingleton(factory, deps)`
- `defineAppTeardown(resources)`

Naming rule:

- `create...` macros produce values or instances.
- `define...` macros produce functions or providers.

## Usage

```ts
import {
  createAsyncSingleton,
  createLazySingleton,
  createSingleton,
  defineAsyncSingleton,
  defineLazySingleton,
  defineSingleton,
  defineTransient,
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

## Runtime Behavior

These APIs are compile-time macros. They must be transformed during build by `unplugin-compdi` or a package that re-exports it.

If a macro call reaches runtime without transformation, it throws by design.

## License

MIT
