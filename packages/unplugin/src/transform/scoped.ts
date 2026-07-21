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
  valueType?: string,
  onReleaseExpr?: string
): string {
  const mapVar = `__registry_${name}`;
  const ctxType = contextKeyType ?? "unknown";
  const ctxParam = contextKeyType ? `${contextIdArg}: ${ctxType}` : contextIdArg;
  const mapType = valueType ? `<${ctxType}, ${valueType}>` : "";
  const releaseLines = onReleaseExpr ? [
    `__getScoped_${name}.release = (${ctxParam}) => {`,
    `  if (!${mapVar}.has(${contextIdArg})) return undefined;`,
    `  const __val = ${mapVar}.get(${contextIdArg});`,
    `  ${mapVar}.delete(${contextIdArg});`,
    `  const __cleanup: unknown = Reflect.apply((${onReleaseExpr}), undefined, [__val, ${contextIdArg}]);`,
    `  if (__cleanup && typeof (__cleanup as PromiseLike<void>).then === "function") {`,
    `    return Promise.resolve(__cleanup).then(() => __val);`,
    `  }`,
    `  return __val;`,
    `};`
  ] : [
    `__getScoped_${name}.release = (${ctxParam}) => {`,
    `  const __val = ${mapVar}.get(${contextIdArg});`,
    `  ${mapVar}.delete(${contextIdArg});`,
    `  return __val;`,
    `};`
  ];

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
    ...releaseLines
  ].join("\n");
}

function buildContextualScopedProxy(
  name: string,
  scopeName: string,
  exported: boolean,
  instantiationExpr: string,
  contextExpr: string,
  contextKeyType?: string,
  valueType?: string,
  onReleaseExpr?: string
): string {
  const mapVar = `__registry_${name}`;
  const resolveVar = `__resolveScoped_${name}`;
  const controllerVar = `__controller_${name}`;
  const contextVar = `__getContext_${name}`;
  const createVar = `__createScoped_${name}`;
  const ctxType = contextKeyType ?? `ReturnType<typeof ${contextVar}>`;
  const resolvedValueType = valueType ?? `ReturnType<typeof ${createVar}>`;
  const mapType = `<${ctxType}, ${resolvedValueType}>`;
  const proxyTarget = `{} as ${resolvedValueType}`;
  const proxyType = ` as ${resolvedValueType}`;
  const cleanupLines = onReleaseExpr ? [
    `    const __cleanup: unknown = Reflect.apply((${onReleaseExpr}), undefined, [__instance, __context]);`,
    `    if (__cleanup && typeof (__cleanup as PromiseLike<void>).then === "function") {`,
    `      return Promise.resolve(__cleanup).then(() => __instance);`,
    `    }`
  ] : [];

  return [
    `const ${contextVar} = ${contextExpr};`,
    `const ${createVar} = () => ${instantiationExpr};`,
    `const ${mapVar} = new Map${mapType}();`,
    `const ${resolveVar} = () => {`,
    `  const __context = ${contextVar}();`,
    `  const __existing = ${mapVar}.get(__context);`,
    `  if (__existing !== undefined) return __existing;`,
    `  const __instance = ${createVar}();`,
    `  ${mapVar}.set(__context, __instance);`,
    `  return __instance;`,
    `};`,
    `const ${controllerVar} = {`,
    `  has: (__context: ${ctxType}) => ${mapVar}.has(__context),`,
    `  peek: (__context: ${ctxType}) => ${mapVar}.get(__context),`,
    `  release: (__context: ${ctxType}) => {`,
    `    const __instance = ${mapVar}.get(__context);`,
    `    if (__instance === undefined) return undefined;`,
    `    ${mapVar}.delete(__context);`,
    ...cleanupLines,
    `    return __instance;`,
    `  },`,
    `};`,
    `const __proxy_${name} = new Proxy(${proxyTarget}, {`,
    `  get(_target, __property) {`,
    `    const __instance = ${resolveVar}();`,
    `    const __value: unknown = Reflect.get(__instance, __property, __instance);`,
    `    return typeof __value === "function" ? __value.bind(__instance) : __value;`,
    `  },`,
    `  set(_target, __property, __value: unknown) {`,
    `    const __instance = ${resolveVar}();`,
    `    return Reflect.set(__instance, __property, __value, __instance);`,
    `  },`,
    `  has(_target, __property) {`,
    `    return Reflect.has(${resolveVar}(), __property);`,
    `  },`,
    `  ownKeys() {`,
    `    return Reflect.ownKeys(${resolveVar}());`,
    `  },`,
    `  getOwnPropertyDescriptor(_target, __property) {`,
    `    return Reflect.getOwnPropertyDescriptor(${resolveVar}(), __property);`,
    `  },`,
    `})${proxyType};`,
    `${exported ? "export " : ""}const [${name}, ${scopeName}] = [__proxy_${name}, ${controllerVar}] as const;`
  ].filter((line) => line !== "").join("\n");
}

export function collectScopedReplacements(
  code: string,
  bindings: ReadonlyMap<string, BindingInfo>,
  ms: MagicString
): boolean {
  let found = false;

  for (const match of collectMacroMatches(code, "createScoped")) {
    const { name, scopeName, exported, options, start, end, typeArgs } = match;
    const deps = resolveDependencies(options.deps, bindings);
    const expr = buildInstantiation(options, deps);
    const valueType = typeArgs[0];
    const contextKeyType = typeArgs[1];
    if (!options.context || !scopeName) continue;
    ms.overwrite(start, end, buildContextualScopedProxy(
      name,
      scopeName,
      exported,
      expr,
      options.context,
      contextKeyType,
      valueType,
      options.onRelease
    ));
    found = true;
  }

  for (const match of collectMacroMatches(code, "defineScoped")) {
    const { name, exported, options, start, end, typeArgs } = match;
    const deps = resolveDependencies(options.deps, bindings);
    const expr = buildInstantiation(options, deps);
    const valueType = typeArgs[0];
    const contextKeyType = typeArgs[1];
    ms.overwrite(start, end, [
      buildScopedGetter(name, expr, "__ctx", contextKeyType, valueType, options.onRelease),
      `${exported ? "export " : ""}const ${name} = __getScoped_${name};`
    ].join("\n"));
    found = true;
  }

  return found;
}
