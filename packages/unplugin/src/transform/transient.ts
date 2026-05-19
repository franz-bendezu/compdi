import type MagicString from "magic-string";
import { collectMacroMatches, resolveDependencies } from "./context";
import type { BindingInfo } from "./types";
import { buildInstantiation } from "./shared";

export function collectTransientReplacements(
  code: string,
  bindings: ReadonlyMap<string, BindingInfo>,
  ms: MagicString
): boolean {
  let found = false;

  for (const match of collectMacroMatches(code, "createTransient")) {
    const { name, options, start, end } = match;
    const deps = resolveDependencies(options.deps, bindings);
    const expr = buildInstantiation(options, deps);
    ms.overwrite(start, end, `export const ${name} = () => ${expr};`);
    found = true;
  }

  for (const match of collectMacroMatches(code, "defineTransient")) {
    const { name, options, start, end } = match;
    const deps = resolveDependencies(options.deps, bindings);
    const expr = buildInstantiation(options, deps);
    ms.overwrite(start, end, `export const ${name} = () => ${expr};`);
    found = true;
  }

  return found;
}

