# unplugin-compdi

Build-time transform for Compdi macros.

## Installation

```bash
npm install -D unplugin-compdi
```

## Publishing Locally

```bash
npm run build --workspace packages/unplugin
npm publish --workspace packages/unplugin
```

## Exports

- `unplugin-compdi`
- `unplugin-compdi/vite`
- `unplugin-compdi/rollup`
- `unplugin-compdi/rolldown`
- `unplugin-compdi/rspack`
- `unplugin-compdi/esbuild`

## Usage

The plugin scans JavaScript and TypeScript source files and rewrites Compdi macro calls before runtime.

### Options

```ts
type CompdiPluginOptions = {
  include?: RegExp;
};
```

By default, the plugin includes files matching `\.[cm]?[jt]sx?$`.

<details>
<summary>Vite</summary>

```ts
import { defineConfig } from "vite";
import compdi from "unplugin-compdi/vite";

export default defineConfig({
  plugins: [compdi()],
});
```

</details>

<details>
<summary>Rollup</summary>

```ts
import compdi from "unplugin-compdi/rollup";

export default {
  input: "src/index.ts",
  plugins: [compdi()],
};
```

</details>

<details>
<summary>Rolldown</summary>

```ts
import compdi from "unplugin-compdi/rolldown";

export default {
  plugins: [compdi()],
};
```

</details>

<details>
<summary>Rspack</summary>

```ts
const compdi = require("unplugin-compdi/rspack").default;

module.exports = {
  plugins: [compdi()],
};
```

</details>

<details>
<summary>esbuild</summary>

Requires esbuild plugin support.

```ts
import { build } from "esbuild";
import compdi from "unplugin-compdi/esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  plugins: [compdi()],
});
```

</details>

## Notes

- This package performs build-time transforms only.
- If macros reach runtime without this transform, the runtime stubs in `@compdi/core` will throw.

## License

MIT
