import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/macros.ts',
    'src/plugin/index.ts',
    'src/plugin/vite.ts',
    'src/plugin/rollup.ts',
    'src/plugin/rolldown.ts',
    'src/plugin/rspack.ts',
    'src/plugin/esbuild.ts',
  ],
  format: ['esm'],
  dts: true,
  exports: true,
})
