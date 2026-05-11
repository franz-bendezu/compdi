# compdi monorepo

Monorepo de Compdi con Turborepo.

## Packages

- [packages/core/README.md](packages/core/README.md): API de macros de DI tipadas.
- [packages/compdi/README.md](packages/compdi/README.md): paquete de entrada con API unificada.
- [packages/unplugin/README.md](packages/unplugin/README.md): plugin de transformación en build.
- [packages/shared/README.md](packages/shared/README.md): utilidades internas del compilador.

## Quick start

1. `npm install`
2. `npm run build`
3. `npm run typecheck`

## API Convention

- `create...` macros export values or instances.
- `define...` macros export functions or providers.

Examples:

- `createSingleton(Database, [])` exports a shared `Database` instance.
- `defineTransient(Service, [db])` exports a `() => Service` factory.
- `createLazySingleton(Analytics, [db])` exports a lazily materialized shared instance.
- `defineLazySingleton(Analytics, [db])` exports a lazy getter.

## Workspace scripts

- `npm run build`
- `npm run dev`
- `npm run typecheck`
- `npm run test`