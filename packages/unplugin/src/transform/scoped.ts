import { collectMacroMatches, resolveDependencies } from "./context";
import type { BindingInfo, Replacement } from "./types";
import { buildInstantiation } from "./shared";

/**
 * Scoped DI: one instance per contextId, per binding.
 *
 * Each defineScoped binding gets its own private Map so keys never collide
 * between bindings. The map is exposed via a __release_<name> function so
 * callers can evict entries when a context (e.g. request) is done.
 *
 * defineScoped({ target, deps }) → (contextId?) => instance
 *   - Calling with the same contextId returns the cached instance.
 *   - __release_<name>(contextId) removes the entry, allowing GC.
 */

function buildScopedGetter(
  name: string,
  instantiationExpr: string,
  contextIdArg: string,
  contextKeyType?: string,
  valueType?: string
): string {
  const mapVar = `__registry_${name}`;
  const ctxType = contextKeyType ?? "unknown";
  const ctxParam = `${contextIdArg}: ${ctxType}`;
  const mapType = valueType ? `<${ctxType}, ${valueType}>` : `<${ctxType}, unknown>`;
  return [
    `const ${mapVar} = new Map${mapType}();`,
    `const __getScoped_${name} = (${ctxParam}) => {`,
    `  const __existing = ${mapVar}.get(${contextIdArg});`,
    `  if (__existing) return __existing;`,
    `  const __val = ${instantiationExpr};`,
    `  ${mapVar}.set(${contextIdArg}, __val);`,
    `  return __val;`,
    `};`,
    `__getScoped_${name}.release = (${ctxParam}) => ${mapVar}.delete(${contextIdArg});`
  ].join("\n");
}

export function collectScopedReplacements(
  code: string,
  bindings: ReadonlyMap<string, BindingInfo>,
  out: Replacement[]
): void {

  for (const match of collectMacroMatches(code, "createScoped")) {
    const { name, options, start, end, typeArgs } = match;
    const deps = resolveDependencies(options.deps, bindings);
    const expr = buildInstantiation(options, deps);
    const valueType = typeArgs[0];
    const contextKeyType = typeArgs[1];

    out.push({
      start,
      end,
      code: [
        buildScopedGetter(name, expr, "__ctx", contextKeyType, valueType),
        `export const ${name} = __getScoped_${name}(undefined);`
      ].join("\n")
    });
  }

  for (const match of collectMacroMatches(code, "defineScoped")) {
    const { name, options, start, end, typeArgs } = match;
    const deps = resolveDependencies(options.deps, bindings);
    const expr = buildInstantiation(options, deps);
    const valueType = typeArgs[0];
    const contextKeyType = typeArgs[1];

    out.push({
      start,
      end,
      code: [
        buildScopedGetter(name, expr, "__ctx", contextKeyType, valueType),
        `export const ${name} = __getScoped_${name};`
      ].join("\n")
    });
  }
}
