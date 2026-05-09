# unplugin-compdi

Build-time plugin that transforms Compdi macro calls.

## Status

This package is currently internal to the monorepo and marked as private.

## Exports

- `unplugin-compdi`
- `unplugin-compdi/vite`
- `unplugin-compdi/rollup`

## Vite usage

```ts
import { defineConfig } from "vite";
import compdi from "unplugin-compdi/vite";

export default defineConfig({
  plugins: [compdi({})],
});
```

## Rollup usage

```ts
import compdi from "unplugin-compdi/rollup";

export default {
  input: "src/index.ts",
  plugins: [compdi({})],
};
```

## License

MIT
