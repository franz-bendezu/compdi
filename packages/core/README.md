# @compdi/core

Type-safe macro API for Compdi dependency injection.

## Install

```bash
npm install @compdi/core
```

## What this package provides

This package exports macro signatures used by the Compdi compiler plugin.

- `defineSingleton(Target, deps)`
- `defineTransient(Target, deps)`
- `defineLazySingleton(Target, deps)`
- `defineAsyncSingleton(factory, deps)`
- `defineAppTeardown(resources)`

## Usage

```ts
import {
  defineSingleton,
  defineTransient,
  defineAsyncSingleton,
} from "@compdi/core";

class Database {}
class Service {
  constructor(private readonly db: Database) {}
}

const db = defineSingleton(Database, []);
const createService = defineTransient(Service, [db]);
const connection = defineAsyncSingleton(async () => new Database(), []);
```

## Important runtime note

These APIs are compile-time macros. They must be transformed by the Compdi plugin during build.
If macro calls reach runtime without transformation, they throw by design.

## License

MIT
