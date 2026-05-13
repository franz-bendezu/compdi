import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/macros.ts',
    'src/plugin.ts',
  ],
  format: ['esm'],
  dts: true,
  exports: true,
})
