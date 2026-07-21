import type MagicString from "magic-string";
import { collectMacroMatches, resolveDependencies } from "./context";
import type { BindingInfo } from "./types";
import { buildInstantiation } from "./shared";

/**
 * Scoped DI: one instance per contextId, per binding.
 *
 * Each defineScoped binding gets its own private Map so keys never collide
 * between bindings. The accessor exposes non-creating inspection and release
 * methods so callers can dispose resources when a context is done.
 *
 * defineScoped({ target, deps }) → (contextId?) => instance
 *   - Calling with the same contextId returns the cached instance.
 *   - .has() and .peek() inspect entries without creating them.
 *   - .release() removes and returns an entry, allowing disposal and GC.
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
  const ctxParam = contextKeyType ? `${contextIdArg}: ${ctxType}` : contextIdArg;
  const mapType = valueType ? `<${ctxType}, ${valueType}>` : "";
  return [
    `const ${mapVar} = new Map${mapType}();`,
    `const __getScoped_${name} = (${ctxParam}) => {`,
    `  const __existing = ${mapVar}.get(${contextIdArg});`,
    `  if (__existing) return __existing;`,
    `  const __val = ${instantiationExpr};`,
    `  ${mapVar}.set(${contextIdArg}, __val);`,
    `  return __val;`,
    `};`,
    `__getScoped_${name}.has = (${ctxParam}) => ${mapVar}.has(${contextIdArg});`,
    `__getScoped_${name}.peek = (${ctxParam}) => ${mapVar}.get(${contextIdArg});`,
    `__getScoped_${name}.release = (${ctxParam}) => {`,
    `  const __val = ${mapVar}.get(${contextIdArg});`,
    `  ${mapVar}.delete(${contextIdArg});`,
    `  return __val;`,
    `};`
  ].join("\n");
}

export function collectScopedReplacements(
  code: string,
  bindings: ReadonlyMap<string, BindingInfo>,
  ms: MagicString
): boolean {
  let found = false;

  for (const match of collectMacroMatches(code, "createScoped")) {
    const { name, options, start, end, typeArgs } = match;
    const deps = resolveDependencies(options.deps, bindings);
    const expr = buildInstantiation(options, deps);
    const valueType = typeArgs[0];
    const contextKeyType = typeArgs[1];
    ms.overwrite(start, end, [
      buildScopedGetter(name, expr, "__ctx", contextKeyType, valueType),
      `export const ${name} = __getScoped_${name}(undefined);`
    ].join("\n"));
    found = true;
  }

  for (const match of collectMacroMatches(code, "defineScoped")) {
    const { name, options, start, end, typeArgs } = match;
    const deps = resolveDependencies(options.deps, bindings);
    const expr = buildInstantiation(options, deps);
    const valueType = typeArgs[0];
    const contextKeyType = typeArgs[1];
    ms.overwrite(start, end, [
      buildScopedGetter(name, expr, "__ctx", contextKeyType, valueType),
      `export const ${name} = __getScoped_${name};`
    ].join("\n"));
    found = true;
  }

  return found;
}
