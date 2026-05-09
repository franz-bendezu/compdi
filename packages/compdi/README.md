# compdi

Dependency injection for TypeScript using compile-time macros.

Use `compdi` when you want:

- Typed DI definitions in your code.
- Zero macro calls at runtime (macros are transformed at build time).
- One package for both DI API and plugin entry points.

## Install

```bash
npm install compdi
```

## Quick start (Vite)

1. Add the plugin to `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import compdi from "compdi/unplugin/vite";

export default defineConfig({
  plugins: [compdi({})],
});
```

2. Define dependencies with macros:

```ts
import { defineSingleton, defineTransient } from "compdi";

class Database {}
class Service {
  constructor(private readonly db: Database) {}
}

const db = defineSingleton(Database, []);
const createService = defineTransient(Service, [db]);
```

## What it exports

### Main import: `compdi`

- `defineSingleton`
- `defineTransient`
- `defineLazySingleton`
- `defineAsyncSingleton`
- `defineAppTeardown`
- `compdiPlugin`
- `vitePlugin`
- `rollupPlugin`

### Subpath imports

- `compdi/core`
- `compdi/unplugin`
- `compdi/unplugin/vite`
- `compdi/unplugin/rollup`

## Important

Macros must be transformed during build. If plugin integration is missing, macro calls will throw at runtime by design.

## License

MIT
