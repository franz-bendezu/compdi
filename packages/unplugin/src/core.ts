import type { UnpluginFactory } from "unplugin";
import { transformCompdiMacros } from "./transform/index";

export type CompdiPluginOptions = {
  include?: RegExp;
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

    if (!include.test(id)) {
      return null;
    }

    const transformed = transformCompdiMacros(code, id);
    if (!transformed) {
      return null;
    }

    return transformed;
  }
});
