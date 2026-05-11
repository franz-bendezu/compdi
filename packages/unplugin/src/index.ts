import { createUnplugin } from "unplugin";
import { transformCompdiMacros } from "./transform";

export type CompdiPluginOptions = {
  include?: RegExp;
};

export type CompdiPluginFactory = (options?: CompdiPluginOptions) => unknown;
export type CompdiUnplugin = {
  vite: CompdiPluginFactory;
  rollup: CompdiPluginFactory;
  rolldown: CompdiPluginFactory;
};

const defaultInclude = /\.[cm]?[jt]sx?$/;

const compdiPlugin = createUnplugin<CompdiPluginOptions>((options) => ({
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

    return {
      code: transformed,
      map: null
    };
  }
}));

export const compdi: CompdiUnplugin = {
  vite: (options = {}) => compdiPlugin.vite(options),
  rollup: (options = {}) => compdiPlugin.rollup(options),
  rolldown: (options = {}) => compdiPlugin.rolldown(options),
};

export default compdi;
export const vite = compdi.vite;
export const rollup = compdi.rollup;
export const rolldown = compdi.rolldown;
