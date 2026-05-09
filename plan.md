# Plan de Implementacion de Compdi

## Phase 1: @compdi/core

Paquete de firmas TypeScript que actuan como macros tipadas. No contiene logica de runtime util.

- Implementar `defineSingleton` para lifetime a nivel modulo.
- Implementar `defineTransient` para lifetime a nivel bloque/fabrica.
- Implementar `defineLazySingleton` para instanciacion diferida.
- Implementar `defineAsyncSingleton` para wiring con top-level await.
- Implementar `defineAppTeardown` para cleanup con `Promise.allSettled`.

## Phase 2: unplugin-compdi

Transformador basado en OXC + MagicString.

- Identificacion: imports desde `@compdi/core`.
- Analisis: resolver macro call + dependencias + target.
- Transformacion: reemplazar macros por JavaScript optimizado.

## Estado Actual

- Estructura Turborepo creada.
- Paquetes `core`, `shared`, `unplugin` inicializados.
- Playground Vite agregado para pruebas manuales.
- Transformaciones base implementadas para singleton, transient, lazy singleton, async singleton y teardown.
