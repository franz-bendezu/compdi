import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/vite.ts', 'src/rollup.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
})
