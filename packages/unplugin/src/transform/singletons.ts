import type MagicString from "magic-string";
import { collectMacroMatches, resolveDependencies } from "./context";
import type { BindingInfo } from "./types";
import { buildInstantiation, buildTypeAnnotation } from "./shared";

export function collectSingletonReplacements(
  code: string,
  bindings: ReadonlyMap<string, BindingInfo>,
  ms: MagicString
): boolean {
  let found = false;

  for (const match of collectMacroMatches(code, "createSingleton")) {
    const { name, options, hasAwait, start, end } = match;
    const deps = resolveDependencies(options.deps, bindings);
    const expr = buildInstantiation(options, deps);
    const rhs = hasAwait ? `await ${expr}` : expr;
    ms.overwrite(start, end, `export const ${name} = ${rhs};`);
    found = true;
  }

  for (const match of collectMacroMatches(code, "defineSingleton")) {
    const { name, options, hasAwait, start, end } = match;
    const binding = bindings.get(name);
    if (!binding) continue;

    const deps = resolveDependencies(options.deps, bindings);

    if (options.lazy) {
      const expr = buildInstantiation(options, deps);
      const typeAnnotation = buildTypeAnnotation(options);
      const typedDecl = typeAnnotation
        ? `let ${binding.instanceName}: ${typeAnnotation} | null = null;`
        : `let ${binding.instanceName} = null;`;
      ms.overwrite(start, end, [
        typedDecl,
        `const ${binding.peekName} = () => ${binding.instanceName};`,
        `export const ${name} = () => {`,
        `  if (!${binding.instanceName}) ${binding.instanceName} = ${expr};`,
        `  return ${binding.instanceName};`,
        `};`
      ].join("\n"));
    } else {
      const expr = buildInstantiation(options, deps);
      const rhs = hasAwait ? `await ${expr}` : expr;
      const typeAnnotation = buildTypeAnnotation(options, hasAwait);
      const typedDecl = typeAnnotation
        ? `const ${binding.instanceName}: ${typeAnnotation} = ${rhs};`
        : `const ${binding.instanceName} = ${rhs};`;
      ms.overwrite(start, end, `${typedDecl}\nexport const ${name} = () => ${binding.instanceName};`);
    }
    found = true;
  }

  return found;
}

