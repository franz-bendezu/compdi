import type { UnpluginFactory } from "unplugin";
import { transformCompdiMacros } from "./transform/index";
import type { CompdiSourceMapMode } from "./transform/index";

export type { CompdiSourceMapMode } from "./transform/index";

export type CompdiPluginOptions = {
  include?: RegExp;
  sourcemap?: CompdiSourceMapMode;
};

const defaultInclude = /\.[cm]?[jt]sx?$/;

export const compdiFactory: UnpluginFactory<
  CompdiPluginOptions | undefined,
  false
> = (options) => ({
  name: "unplugin-compdi",
  enforce: "pre",
  transform(code, id) {
    const include = options?.include ?? defaultInclude;
    include.lastIndex = 0;
    const included = include.test(id);
    include.lastIndex = 0;
    if (!included) {
      return null;
    }

    const transformed = transformCompdiMacros(code, id, options?.sourcemap);
    if (!transformed) {
      return null;
    }

    return transformed;
  }
});
