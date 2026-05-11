import { TRANSIENT_REGEX, resolveDependencies } from "./context";
import type { BindingInfo, Replacement } from "./types";

export function collectTransientReplacements(
  code: string,
  bindings: ReadonlyMap<string, BindingInfo>
): Replacement[] {
  const replacements: Replacement[] = [];

  for (const match of code.matchAll(TRANSIENT_REGEX)) {
    const name = match[1];
    const target = match[2].trim();
    const deps = resolveDependencies(match[3], bindings, "sync");

    replacements.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      code: `export const ${name} = () => new ${target}(${deps});`
    });
  }

  return replacements;
}
