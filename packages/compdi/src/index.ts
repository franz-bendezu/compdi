// Reexport @compdi/core macros
export {
  createSingleton,
  defineSingleton,
  createTransient,
  defineTransient,
  createScoped,
  defineScoped,
  defineAppTeardown,
  type DiOptions,
} from "@compdi/core";

// Reexport unplugin-compdi plugin
export { default as compdiPlugin } from "unplugin-compdi";
export { default as vitePlugin } from "unplugin-compdi/vite";
export { default as rollupPlugin } from "unplugin-compdi/rollup";
export type { CompdiPluginOptions } from "unplugin-compdi";
