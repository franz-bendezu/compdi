import {
  CREATE_SINGLETON_REGEX,
  DEFINE_SINGLETON_REGEX,
  resolveDependencies
} from "./context";
import type { BindingInfo, Replacement } from "./types";

export function collectSingletonReplacements(
  code: string,
  bindings: ReadonlyMap<string, BindingInfo>
): Replacement[] {
  const replacements: Replacement[] = [];

  for (const match of code.matchAll(CREATE_SINGLETON_REGEX)) {
    const name = match[1];
    const target = match[2].trim();
    const deps = resolveDependencies(match[3], bindings, "sync");

    replacements.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      code: `export const ${name} = new ${target}(${deps});`
    });
  }

  for (const match of code.matchAll(DEFINE_SINGLETON_REGEX)) {
    const name = match[1];
    const target = match[2].trim();
    const deps = resolveDependencies(match[3], bindings, "sync");
    const binding = bindings.get(name);
    if (!binding) {
      continue;
    }

    replacements.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      code: `const ${binding.instanceName} = new ${target}(${deps});\nexport const ${name} = () => ${binding.instanceName};`
    });
  }

  return replacements;
}
