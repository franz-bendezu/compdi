# compdi monorepo

Type-safe dependency injection with compile-time macros and unplugin-based build transforms.

## Packages

- [packages/core/README.md](packages/core/README.md): macro signatures and TypeScript types.
- [packages/compdi/README.md](packages/compdi/README.md): main package that re-exports macros and selected plugin helpers.
- [packages/unplugin/README.md](packages/unplugin/README.md): unplugin adapter for Vite, Rollup, Rolldown, Rspack, and esbuild.
- [packages/shared/README.md](packages/shared/README.md): internal parser and transform helpers.

## Quick Start

```bash
npm install
npm run build
npm run typecheck
```

## How Compdi Works

Compdi macros are authoring-time APIs. They are meant to be erased and replaced during build.

```ts
import { createSingleton, defineTransient } from "compdi";
import { defineConfig } from "vite";
import { vitePlugin } from "compdi";

class Database {}
class Service {
	constructor(private readonly db: Database) {}
}

const db = createSingleton(Database, []);
const createService = defineTransient(Service, [db]);

export default defineConfig({
	plugins: [vitePlugin()],
});
```

If a macro call reaches runtime without the transform, it throws by design.

## Naming Convention

- `create...` macros produce values or instances.
- `define...` macros produce functions, providers, or deferred accessors.

Examples:

- `createSingleton(Database, [])` produces one shared `Database` instance.
- `defineSingleton(Database, [])` produces a `() => Database` getter.
- `defineTransient(Service, [db])` produces a `() => Service` factory.
- `createLazySingleton(Analytics, [db])` produces a lazily materialized shared instance.
- `defineLazySingleton(Analytics, [db])` produces a lazy getter.

## Workspace Scripts

- `npm run build`
- `npm run dev`
- `npm run typecheck`
- `npm run test`