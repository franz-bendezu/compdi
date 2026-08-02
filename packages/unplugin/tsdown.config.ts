import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/vite.ts',
    'src/rollup.ts',
    'src/rolldown.ts',
    'src/rspack.ts',
    'src/esbuild.ts',
  ],
  format: ['esm'],
  platform: 'node',
  dts: true,
  clean: true,
  deps: {
    neverBundle: true,
  },
})
