// Reexport @compdi/core macros
export {
  defineSingleton,
  defineTransient,
  defineLazySingleton,
  defineAsyncSingleton,
  defineAppTeardown,
  type Constructor,
  type AsyncFactory,
} from "@compdi/core";

// Reexport unplugin-compdi plugin
export { default as compdiPlugin } from "unplugin-compdi";
export { default as vitePlugin } from "unplugin-compdi/vite";
export { default as rollupPlugin } from "unplugin-compdi/rollup";
export type { CompdiPluginOptions } from "unplugin-compdi";
