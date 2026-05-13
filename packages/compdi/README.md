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
// vite.config.ts
import { defineConfig } from "vite";
import vitePlugin from "compdi/plugin/vite";

export default defineConfig({
  plugins: [vitePlugin()],
});
```

### 2. Define dependencies with macros

```ts
import {
  createSingleton,
  defineSingleton,
  defineTransient,
} from "compdi/macros";

class Database {}

class Service {
  constructor(private readonly db: Database) {}
}

class Analytics {
  constructor(private readonly db: Database) {}
}

const db          = createSingleton({ target: Database, deps: [] });
const createSvc   = defineTransient({ target: Service, deps: [db] });
const useAnalytics = defineSingleton({ target: Analytics, deps: [db], lazy: true });
```

## Subpath Exports

| Import | Contents |
|---|---|
| `compdi/macros` | All macro functions and types |
| `compdi/plugin` | `compdiPlugin`, `vitePlugin`, `rollupPlugin`, `CompdiPluginOptions` |
| `compdi/plugin/vite` | Vite plugin (default export) |
| `compdi/plugin/rollup` | Rollup plugin (default export) |
| `compdi/plugin/rolldown` | Rolldown plugin (default export) |
| `compdi/plugin/rspack` | Rspack plugin (default export) |
| `compdi/plugin/esbuild` | esbuild plugin (default export) |
| `compdi` | Everything (macros + plugin helpers) |

## Macros

- `createSingleton({ target, deps })` / `createSingleton({ factory, deps })`
- `defineSingleton({ target, deps })` / `defineSingleton({ ..., lazy: true })` for lazy
- `createTransient({ target, deps })`
- `defineTransient({ target, deps })`
- `createScoped({ target, deps }, contextId)`
- `defineScoped({ target, deps })`
- `defineAppTeardown(resources)`

Naming rule:

- `create...` macros produce values or instances.
- `define...` macros produce functions or providers.
- Macros are compile-time only and must be erased by the build transform.

## Build Integration

All major build tools are available as dedicated subpath exports. See the [Subpath Exports](#subpath-exports) table above.

## Important

If macro calls reach runtime without the plugin transform, they throw by design.

## License

MIT
