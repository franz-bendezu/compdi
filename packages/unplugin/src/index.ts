import { createUnplugin, type UnpluginInstance } from "unplugin";
import { compdiFactory, type CompdiPluginOptions } from "./core";

const compdiPlugin: UnpluginInstance<
  CompdiPluginOptions | undefined,
  false
> = /* #__PURE__ */ createUnplugin(compdiFactory);

export const compdi = compdiPlugin;
export type { CompdiPluginOptions } from "./core";

export default compdi;
export const vite = compdi.vite;
export const rollup = compdi.rollup;
export const rolldown = compdi.rolldown;
export const rspack = compdi.rspack;
export const esbuild = compdi.esbuild;
