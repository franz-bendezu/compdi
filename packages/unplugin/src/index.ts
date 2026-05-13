import { createUnplugin } from "unplugin";
import { transformCompdiMacros } from "./transform/index";

export type CompdiPluginOptions = {
  include?: RegExp;
};

const defaultInclude = /\.[cm]?[jt]sx?$/;

const compdiPlugin = createUnplugin((options?: CompdiPluginOptions) => ({
  name: "unplugin-compdi",
  enforce: "pre",
  transform(code, id) {
    const include = options?.include ?? defaultInclude;

    if (!include.test(id)) {
      return null;
    }

    const transformed = transformCompdiMacros(code, id);
    if (!transformed) {
      return null;
    }

    return transformed;
  }
}));

export const compdi = compdiPlugin;

export default compdi;
export const vite = compdi.vite;
export const rollup = compdi.rollup;
export const rolldown = compdi.rolldown;
export const rspack = compdi.rspack;
export const esbuild = compdi.esbuild;
