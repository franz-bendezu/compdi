# @compdi/core

Type-safe macro API for Compdi dependency injection.

## Installation

```bash
npm install @compdi/core
```

## API

This package exports the macro signatures consumed by the Compdi build transform.

- `createSingleton({ target, deps, lazy? })` / `createSingleton({ factory, deps, lazy? })`
- `defineSingleton({ target, deps, lazy? })` / `defineSingleton({ factory, deps, lazy? })`
- `createTransient({ target, deps })` / `createTransient({ factory, deps })`
- `defineTransient({ target, deps })` / `defineTransient({ factory, deps })` (deprecated alias of `createTransient`)
- `createScoped({ target, deps, context })` / `createScoped({ factory, deps, context })`
- `defineScoped({ target, deps })` / `defineScoped({ factory, deps })`
- `defineAppTeardown(resources)`

Naming rule:

- `createSingleton` and `createScoped` produce values directly.
- `createTransient` produces a factory that creates a new instance on each call.
- `define...` macros produce functions, getters, or accessors.
- Pass `lazy: true` to `createSingleton` / `defineSingleton` for lazy initialization.
- Pass an async `factory` for async singleton resolution.

## Usage

```ts
import {
  createSingleton,
  defineSingleton,
  createTransient,
  defineTransient,
  createScoped,
  defineScoped,
  defineAppTeardown,
} from "@compdi/core";

class Database {}

class Service {
  constructor(private readonly db: Database) {}
}

interface Request {}
declare const useRequest: () => Request;

// Eager singleton
const db = createSingleton({ target: Database, deps: [] });

// Singleton getter
const useDb = defineSingleton({ target: Database, deps: [] });

// Lazy singleton getter
const useLazyDb = defineSingleton({ target: Database, deps: [], lazy: true });

// Async singleton via factory
const conn = createSingleton({ factory: async (db: Database) => db, deps: [db] });

// Transient factory — new instance on every call
const createSvc = createTransient({ target: Service, deps: [db] });
const svc = createSvc();

// Deprecated alias with the same transient behavior
const makeSvc = defineTransient({ target: Service, deps: [db] });

// Scoped — per-context instance
const [scopedSvc, scopedSvcScope] = createScoped({
  target: Service,
  deps: [db],
  context: useRequest,
});
const getScopedSvc = defineScoped({ target: Service, deps: [db] });
```

## Runtime Behavior

These APIs are compile-time macros. They must be transformed during build by `unplugin-compdi` or a package that re-exports it.

If a macro call reaches runtime without transformation, it throws by design.

## License

MIT
