import {
  CREATE_LAZY_REGEX,
  DEFINE_LAZY_REGEX,
  resolveDependencies
} from "./context";
import type { BindingInfo, Replacement } from "./types";

export function collectLazyReplacements(
  code: string,
  bindings: ReadonlyMap<string, BindingInfo>
): Replacement[] {
  const replacements: Replacement[] = [];

  for (const match of code.matchAll(CREATE_LAZY_REGEX)) {
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
      code: [
        `let ${binding.instanceName} = null;`,
        `const ${binding.getterName} = () => {`,
        `  if (!${binding.instanceName}) ${binding.instanceName} = new ${target}(${deps});`,
        `  return ${binding.instanceName};`,
        `};`,
        `const ${binding.peekName} = () => ${binding.instanceName};`,
        `export const ${name} = new Proxy({}, {`,
        `  get: (_, prop) => {`,
        `    return Reflect.get(${binding.getterName}(), prop);`,
        `  }`,
        `});`
      ].join("\n")
    });
  }

  for (const match of code.matchAll(DEFINE_LAZY_REGEX)) {
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
      code: [
        `let ${binding.instanceName} = null;`,
        `const ${binding.getterName} = () => {`,
        `  if (!${binding.instanceName}) ${binding.instanceName} = new ${target}(${deps});`,
        `  return ${binding.instanceName};`,
        `};`,
        `const ${binding.peekName} = () => ${binding.instanceName};`,
        `export const ${name} = ${binding.getterName};`
      ].join("\n")
    });
  }

  return replacements;
}
