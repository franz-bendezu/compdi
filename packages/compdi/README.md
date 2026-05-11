# compdi

Dependency injection for TypeScript using compile-time macros.

Use `compdi` when you want typed DI definitions in source code and zero macro calls left at runtime.

## Installation

```bash
npm install compdi
```

## Quick Start

### 1. Add the plugin

```ts
import { defineConfig } from "vite";
import { vitePlugin } from "compdi";

export default defineConfig({
  plugins: [vitePlugin()],
});
```

### 2. Define dependencies with macros

```ts
import {
  createSingleton,
  createLazySingleton,
  defineTransient,
} from "compdi";

class Database {}

class Service {
  constructor(private readonly db: Database) {}
}

class Analytics {
  constructor(private readonly db: Database) {}
}

const db = createSingleton(Database, []);
const createService = defineTransient(Service, [db]);
const analytics = createLazySingleton(Analytics, [db]);
```

## Exports

The main `compdi` entry currently exports:

- `createSingleton`
- `defineSingleton`
- `defineTransient`
- `createLazySingleton`
- `defineLazySingleton`
- `createAsyncSingleton`
- `defineAsyncSingleton`
- `defineAppTeardown`
- `compdiPlugin`
- `vitePlugin`
- `rollupPlugin`
- `CompdiPluginOptions`

## Macro Rules

- `create...` macros produce values or instances.
- `define...` macros produce functions or providers.
- Macros are compile-time only and must be erased by the build transform.

Examples:

- `createSingleton(Database, [])` produces a shared `Database` instance.
- `defineSingleton(Database, [])` produces a `() => Database` getter.
- `defineTransient(Service, [db])` produces a `() => Service` factory.
- `createAsyncSingleton(factory, deps)` produces an awaited singleton value.
- `defineAppTeardown(resources)` produces an async teardown function.

## Build Integration

If you need builder-specific entry points beyond the helpers re-exported here, use `unplugin-compdi` directly.

## Important

If macro calls reach runtime without the plugin transform, they throw by design.

## License

MIT
