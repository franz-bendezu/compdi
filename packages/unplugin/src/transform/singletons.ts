import { collectMacroMatches, resolveDependencies } from "./context";
import type { BindingInfo, Replacement } from "./types";
import { buildInstantiation, buildTypeAnnotation } from "./shared";

export function collectSingletonReplacements(
  code: string,
  bindings: ReadonlyMap<string, BindingInfo>,
  out: Replacement[]
): void {

  for (const match of collectMacroMatches(code, "createSingleton")) {
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

  for (const match of collectMacroMatches(code, "defineSingleton")) {
    const { name, options, hasAwait, start, end } = match;
    const binding = bindings.get(name);
    if (!binding) continue;

    const deps = resolveDependencies(options.deps, bindings);

    if (options.lazy) {
      // Lazy: instantiate on first access
      const expr = buildInstantiation(options, deps);
      const typeAnnotation = buildTypeAnnotation(options);
      const typedDecl = typeAnnotation
        ? `let ${binding.instanceName}: ${typeAnnotation} | null = null;`
        : `let ${binding.instanceName} = null;`;
      out.push({
        start,
        end,
        code: [
          typedDecl,
          `const ${binding.peekName} = () => ${binding.instanceName};`,
          `export const ${name} = () => {`,
          `  if (!${binding.instanceName}) ${binding.instanceName} = ${expr};`,
          `  return ${binding.instanceName};`,
          `};`
        ].join("\n")
      });
    } else {
      // Eager: respect hasAwait — user writes `await defineSingleton(...)` to resolve the factory
      // at init time (getter becomes sync); omitting await stores the raw return value (e.g. Promise).
      const expr = buildInstantiation(options, deps);
      const rhs = hasAwait ? `await ${expr}` : expr;
      const typeAnnotation = buildTypeAnnotation(options, hasAwait);
      const typedDecl = typeAnnotation
        ? `const ${binding.instanceName}: ${typeAnnotation} = ${rhs};`
        : `const ${binding.instanceName} = ${rhs};`;
      out.push({
        start,
        end,
        code: `${typedDecl}\nexport const ${name} = () => ${binding.instanceName};`
      });
    }
  }
}

