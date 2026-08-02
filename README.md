# compdi

> Zero-overhead, compile-time dependency injection for TypeScript — no `reflect-metadata`, no runtime container. Macro-based today, decorator-based tomorrow.

[![npm](https://img.shields.io/npm/v/compdi)](https://www.npmjs.com/package/compdi)
[![license](https://img.shields.io/npm/l/compdi)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5%2B-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-supported-646cff)](https://vitejs.dev/)
[![Rollup](https://img.shields.io/badge/Rollup-supported-ef3335)](https://rollupjs.org/)

**compdi** is a TypeScript dependency injection library that works entirely at build time. Write typed DI definitions using plain macro calls — the compiler plugin erases them and inlines the wiring before your code reaches the browser or Node.js. No runtime container. No decorators. No `reflect-metadata`.

## Why compdi?

- **Macro-first API** — plain function calls, no `@Injectable()` or `@Inject()` required today
- **No `reflect-metadata`** — zero polyfills or tsconfig flags required
- **Compile-time erasure** — macros are rewritten by the build plugin; nothing runs at runtime
- **Full TypeScript inference** — dependency types are inferred from constructor/factory signatures
- **Tree-shakable** — only the wired instances end up in your bundle
- **Universal build tool support** — Vite, Rollup, Rolldown, Rspack, and esbuild

## Installation

```bash
npm install compdi
# or
pnpm add compdi
# or
yarn add compdi
```

## Quick Start

### 1. Register the build plugin

**Vite**
```ts
// vite.config.ts
import { defineConfig } from "vite";
import { vitePlugin } from "compdi/plugin";

export default defineConfig({
  plugins: [vitePlugin()],
});
```

**Rollup**
```ts
// rollup.config.ts
import rollupPlugin from "compdi/plugin/rollup";

export default {
  plugins: [rollupPlugin()],
};
```

### 2. Define your dependencies

```ts
import { createSingleton, defineSingleton, createTransient } from "compdi/macros";

class Database {}

class UserService {
  constructor(private readonly db: Database) {}
}

class Analytics {
  constructor(private readonly db: Database) {}
}

// Eager singleton — one shared instance
const db = createSingleton({ target: Database, deps: [] });

// Transient — new instance on every call
const createUserService = createTransient({ target: UserService, deps: [db] });

// Lazy singleton — created on first access (lazy option on defineSingleton)
const useAnalytics = defineSingleton({ target: Analytics, deps: [db], lazy: true });
```

### 3. Use your dependencies

```ts
const service = createUserService();  // fresh UserService every time
const stats   = useAnalytics();       // lazy singleton, initialized on first use
```

No container. No token strings. No runtime overhead.

## Subpath Exports

```ts
import { createSingleton, createTransient } from "compdi/macros";       // macro definitions only
import { vitePlugin, rollupPlugin }         from "compdi/plugin";        // all plugin helpers
import vitePlugin                           from "compdi/plugin/vite";   // vite only
import rollupPlugin                         from "compdi/plugin/rollup"; // rollup only
import { createSingleton, vitePlugin }      from "compdi";               // everything
```

## Macro Reference

| Macro | Returns | Description |
|---|---|---|
| `createSingleton({ target, deps })` | `T` | Eager shared instance |
| `createSingleton({ factory, deps })` | `T` or `Promise<T>` | Eager singleton from factory (async supported) |
| `defineSingleton({ target, deps })` | `() => T` | Getter for a shared instance |
| `defineSingleton({ target, deps, lazy: true })` | `() => T` | Lazy getter — instance created on first call |
| `createTransient({ target, deps })` | `() => T` | Factory — new instance on every call |
| `defineTransient({ target, deps })` | `() => T` | Factory — new instance on every call |
| `createScoped({ target, deps, context })` | `[ScopedProxy<T>, ScopedController<T, K>]` | Stable proxy and its scope controller |
| `defineScoped({ target, deps })` | `ScopedAccessor<T>` | Deferred per-context accessor |
| `defineAppTeardown(resources)` | `() => Promise<void>` | Experimental async cleanup for all resources; may be removed |

> If a macro call reaches runtime without the build plugin, it throws by design.

## Naming Convention

- `createSingleton` / `createScoped` — produces a value or instance directly.
- `createTransient` — produces a factory for a fresh instance on each call.
- `defineTransient` — produces a factory for a fresh instance on each call.
- `define...` — produces a function, getter, or deferred accessor.

## Supported Build Tools

| Tool | Import |
|---|---|
| Vite | `compdi/plugin/vite` |
| Rollup | `compdi/plugin/rollup` |
| Rolldown | `compdi/plugin/rolldown` |
| Rspack | `compdi/plugin/rspack` |
| esbuild | `compdi/plugin/esbuild` |

## Packages

| Package | Description |
|---|---|
| [`compdi`](packages/compdi/README.md) | Main package — macros + plugin helpers |
| [`@compdi/core`](packages/core/README.md) | Macro type signatures and TypeScript types |
| [`unplugin-compdi`](packages/unplugin/README.md) | Build-time transform (Vite, Rollup, Rolldown, Rspack, esbuild) |

## Contributing / Development

```bash
npm install
npm run build
npm run typecheck
npm run test
```

The monorepo applications live in `apps/`:

```bash
pnpm --filter @compdi/playground dev  # interactive lifecycle demo
pnpm --filter @compdi/docs dev        # documentation site
```

## Roadmap

- [ ] **Decorator support** — compile-time `@Injectable` / `@Inject` transforms that work without `reflect-metadata`, erased by the same build plugin
- [ ] Automatic dependency graph visualization
- [ ] IDE plugin for dependency resolution hints

## License

MIT
