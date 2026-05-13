import { collectMacroMatches, resolveDependencies } from "./context";
import type { BindingInfo, Replacement } from "./types";
import { buildInstantiation } from "./shared";

export function collectTransientReplacements(
  code: string,
  bindings: ReadonlyMap<string, BindingInfo>,
  out: Replacement[]
): void {

  for (const match of collectMacroMatches(code, "createTransient")) {
    const { name, options, hasAwait, start, end } = match;
    const deps = resolveDependencies(options.deps, bindings);
    const expr = buildInstantiation(options, deps);
    const rhs = hasAwait ? `await ${expr}` : expr;

    out.push({
      start,
      end,
      code: `export const ${name} = ${rhs};`
    });
  }

  for (const match of collectMacroMatches(code, "defineTransient")) {
    const { name, options, start, end } = match;
    const deps = resolveDependencies(options.deps, bindings);
    const expr = buildInstantiation(options, deps);

    out.push({
      start,
      end,
      code: `export const ${name} = () => ${expr};`
    });
  }
}

