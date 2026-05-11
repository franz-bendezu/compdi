import { parseSync } from "oxc-parser";
import { splitDependencyList } from "@compdi/shared";
import type { BindingInfo, BindingKind } from "./types";

export const CORE_IMPORT_REGEX = /import\s*{[^}]*}\s*from\s*["'](?:@compdi\/core|compdi)["'];?\s*/g;
export const CREATE_SINGLETON_REGEX =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*createSingleton\(\s*([\s\S]*?),\s*\[([\s\S]*?)\]\s*\)\s*;?/g;
export const DEFINE_SINGLETON_REGEX =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*defineSingleton\(\s*([\s\S]*?),\s*\[([\s\S]*?)\]\s*\)\s*;?/g;
export const TRANSIENT_REGEX =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*defineTransient\(\s*([\s\S]*?),\s*\[([\s\S]*?)\]\s*\)\s*;?/g;
export const CREATE_LAZY_REGEX =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*createLazySingleton\(\s*([\s\S]*?),\s*\[([\s\S]*?)\]\s*\)\s*;?/g;
export const DEFINE_LAZY_REGEX =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*defineLazySingleton\(\s*([\s\S]*?),\s*\[([\s\S]*?)\]\s*\)\s*;?/g;
export const TEARDOWN_REGEX =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*defineAppTeardown\(\s*\[([\s\S]*?)\]\s*\)\s*;?/g;

export function parseWithOxc(code: string, id: string): boolean {
  try {
    parseSync(id, code, { showSemanticErrors: false });
    return true;
  } catch {
    return false;
  }
}

function createBindingInfo(name: string, kind: BindingKind): BindingInfo {
  switch (kind) {
    case "create-singleton":
    case "define-singleton":
    case "create-async-singleton":
      return {
        kind,
        instanceName: `__${name}`
      };
    case "create-lazy-singleton":
    case "define-lazy-singleton":
      return {
        kind,
        instanceName: `__lazy_${name}`,
        getterName: `__get_${name}`,
        peekName: `__peek_${name}`
      };
    case "define-async-singleton":
      return {
        kind,
        instanceName: `__value_${name}`,
        getterName: `__get_${name}`,
        peekName: `__peek_${name}`,
        promiseName: `__promise_${name}`
      };
  }
}

export function collectBindings(code: string): Map<string, BindingInfo> {
  const bindings = new Map<string, BindingInfo>();

  const register = (regex: RegExp, kind: BindingKind): void => {
    for (const match of code.matchAll(regex)) {
      bindings.set(match[1], createBindingInfo(match[1], kind));
    }
  };

  register(CREATE_SINGLETON_REGEX, "create-singleton");
  register(DEFINE_SINGLETON_REGEX, "define-singleton");
  register(CREATE_LAZY_REGEX, "create-lazy-singleton");
  register(DEFINE_LAZY_REGEX, "define-lazy-singleton");

  const createAsyncHeadRegex =
    /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*createAsyncSingleton\s*\(/g;
  for (const match of code.matchAll(createAsyncHeadRegex)) {
    bindings.set(match[1], createBindingInfo(match[1], "create-async-singleton"));
  }

  const defineAsyncHeadRegex =
    /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*defineAsyncSingleton\s*\(/g;
  for (const match of code.matchAll(defineAsyncHeadRegex)) {
    bindings.set(match[1], createBindingInfo(match[1], "define-async-singleton"));
  }

  return bindings;
}

function resolveDependencyExpression(
  dependency: string,
  bindings: ReadonlyMap<string, BindingInfo>,
  mode: "sync" | "async"
): string {
  const binding = bindings.get(dependency);
  if (!binding) {
    return dependency;
  }

  switch (binding.kind) {
    case "create-singleton":
    case "define-singleton":
    case "create-async-singleton":
      return binding.instanceName;
    case "create-lazy-singleton":
    case "define-lazy-singleton":
      return `${binding.getterName}()`;
    case "define-async-singleton":
      return mode === "async" ? `await ${binding.getterName}()` : dependency;
  }
}

export function resolveDependencies(
  rawDependencies: string,
  bindings: ReadonlyMap<string, BindingInfo>,
  mode: "sync" | "async"
): string {
  const deps = splitDependencyList(rawDependencies).map((dependency) =>
    resolveDependencyExpression(dependency, bindings, mode)
  );

  return deps.join(", ");
}

export function resolveTeardownResource(
  resource: string,
  bindings: ReadonlyMap<string, BindingInfo>
): { expression: string; awaitExpression: boolean } {
  const binding = bindings.get(resource);
  if (!binding) {
    return { expression: resource, awaitExpression: false };
  }

  switch (binding.kind) {
    case "create-singleton":
    case "define-singleton":
    case "create-async-singleton":
      return {
        expression: binding.instanceName,
        awaitExpression: false
      };
    case "create-lazy-singleton":
    case "define-lazy-singleton":
      return {
        expression: `${binding.peekName}()`,
        awaitExpression: false
      };
    case "define-async-singleton":
      return {
        expression: `${binding.peekName}()`,
        awaitExpression: true
      };
  }
}
