import { parseSync } from "oxc-parser";
import { findMatchingParen, splitDependencyList } from "./shared";
import type { BindingInfo, BindingKind } from "./types";

export const CORE_IMPORT_REGEX = /import\s*{[^}]*}\s*from\s*["'](?:@compdi\/core|compdi\/macros|compdi)["'];?\s*/g;
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

/**
 * Parsed representation of a DiOptions object literal.
 */
export interface ParsedDiOptions {
  /** Value of the `target` property (class identifier), or undefined */
  target?: string;
  /** Value of the `factory` property (function expression/identifier), or undefined */
  factory?: string;
  /** Raw contents inside the `deps` array, or empty string */
  deps: string;
  /** Whether `lazy: true` was present */
  lazy: boolean;
  /** Active-context resolver for contextual scoped proxies. */
  context?: string;
  /** Optional contextual scoped cleanup callback. */
  onRelease?: string;
}

/**
 * Extract properties from an object literal string like
 * `{ target: Foo, deps: [A, B], lazy: true }`.
 * Returns null if the source doesn't start with `{`.
 */
export function parseDiOptions(objectSource: string): ParsedDiOptions | null {
  const src = objectSource.trim();
  if (!src.startsWith("{")) return null;

  // Find matching closing brace
  let depth = 0;
  let closeIndex = -1;
  for (let i = 0; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        closeIndex = i;
        break;
      }
    }
  }
  if (closeIndex < 0) return null;

  const inner = src.slice(1, closeIndex);

  const result: ParsedDiOptions = { deps: "", lazy: false };

  // Extract `target: Identifier`
  const targetMatch = inner.match(/\btarget\s*:\s*([A-Za-z_$][\w$]*)/);
  if (targetMatch) result.target = targetMatch[1];

  // Extract `factory: <expression>` — could be an identifier or arrow/function expr
  // We look for `factory:` and take until the next top-level `,` or `}`
  const factoryKeyIndex = inner.search(/\bfactory\s*:/);
  if (factoryKeyIndex >= 0) {
    const afterColon = inner.indexOf(":", factoryKeyIndex) + 1;
    result.factory = extractValueAt(inner, afterColon).trim();
  }

  for (const key of ["context", "onRelease"] as const) {
    const keyIndex = inner.search(new RegExp(`\\b${key}\\s*:`));
    if (keyIndex >= 0) {
      const afterColon = inner.indexOf(":", keyIndex) + 1;
      result[key] = extractValueAt(inner, afterColon).trim();
    }
  }

  // Extract `deps: [...]`
  const depsKeyIndex = inner.search(/\bdeps\s*:/);
  if (depsKeyIndex >= 0) {
    const afterColon = inner.indexOf(":", depsKeyIndex) + 1;
    const val = extractValueAt(inner, afterColon).trim();
    // val should be `[...]`, extract inside
    if (val.startsWith("[")) {
      result.deps = val.slice(1, val.lastIndexOf("]"));
    }
  }

  // Extract `lazy: true`
  if (/\blazy\s*:\s*true\b/.test(inner)) result.lazy = true;

  return result;
}

/**
 * Extract a top-level value starting at `start` in `source`, stopping at
 * the first top-level `,` not inside brackets/braces/parens, or end of string.
 */
function extractValueAt(source: string, start: number): string {
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let i = start;
  // skip whitespace
  while (i < source.length && /\s/.test(source[i])) i++;
  const begin = i;
  for (; i < source.length; i++) {
    const c = source[i];
    if (c === "(") depthParen++;
    else if (c === ")") depthParen--;
    else if (c === "[") depthBracket++;
    else if (c === "]") depthBracket--;
    else if (c === "{") depthBrace++;
    else if (c === "}") {
      if (depthBrace === 0) break; // we've hit the outer brace
      depthBrace--;
    } else if (c === "," && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      break;
    }
  }
  return source.slice(begin, i);
}

/**
 * Matches all calls of the form:
 *   export const <name> = <macroName>({ ... });
 * Returns an iterator of [fullMatch, name, objectSource, start, end].
 */
export interface MacroMatch {
  name: string;
  /** Second binding in `[value, scope]` declarations. */
  scopeName?: string;
  options: ParsedDiOptions;
  /** Whether the macro call was preceded by `await` (e.g. `await createSingleton(...)`) */
  hasAwait: boolean;
  /** Raw type arguments from the generic, e.g. ['IRequestContext', 'RequestCtx'] */
  typeArgs: string[];
  start: number;
  end: number;
}

export function* collectMacroMatches(
  code: string,
  macroName: string
): Generator<MacroMatch> {
  const headRegex = new RegExp(
    `export\\s+const\\s+(?:([A-Za-z_$][\\w$]*)|\\[\\s*([A-Za-z_$][\\w$]*)\\s*,\\s*([A-Za-z_$][\\w$]*)\\s*\\])\\s*=\\s*(await\\s+)?${macroName}\\s*(?:<([^>]*)>)?\\s*\\(`,
    "g"
  );
  let m = headRegex.exec(code);
  while (m) {
    const name = m[1] ?? m[2];
    const scopeName = m[3];
    if (scopeName && macroName !== "createScoped") {
      m = headRegex.exec(code);
      continue;
    }
    const hasAwait = m[4] !== undefined;
    const rawTypeArgs = m[5];
    const typeArgs = rawTypeArgs
      ? rawTypeArgs.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const openParen = headRegex.lastIndex - 1;
    const closeParen = findMatchingParen(code, openParen);
    if (closeParen < 0) {
      m = headRegex.exec(code);
      continue;
    }
    let endIndex = closeParen + 1;
    while (endIndex < code.length && /\s/.test(code[endIndex])) endIndex++;
    if (code[endIndex] === ";") endIndex++;

    const argsSource = code.slice(openParen + 1, closeParen).trim();
    const options = parseDiOptions(argsSource);
    if (options) {
      yield { name, scopeName, options, hasAwait, typeArgs, start: m.index, end: endIndex };
    }
    headRegex.lastIndex = endIndex;
    m = headRegex.exec(code);
  }
}

function createBindingInfo(name: string, kind: BindingKind): BindingInfo {
  switch (kind) {
    case "create-singleton":
    case "create-transient":
    case "create-scoped":
      return { kind, instanceName: name };
    case "define-singleton":
      return { kind, instanceName: `__${name}` };
    case "define-singleton-lazy":
      return { kind, instanceName: `__lazy_${name}`, peekName: `__peek_${name}` };
    case "define-transient":
    case "define-scoped":
      return { kind, instanceName: name };
  }
}

export function collectBindings(code: string): Map<string, BindingInfo> {
  const bindings = new Map<string, BindingInfo>();

  const register = (macroName: string, kind: BindingKind): void => {
    for (const match of collectMacroMatches(code, macroName)) {
      // For define-singleton, check lazy flag to determine actual kind
      if (macroName === "defineSingleton" && match.options.lazy) {
        bindings.set(match.name, createBindingInfo(match.name, "define-singleton-lazy"));
      } else {
        bindings.set(match.name, createBindingInfo(match.name, kind));
      }
    }
  };

  register("createSingleton", "create-singleton");
  register("defineSingleton", "define-singleton");
  register("createTransient", "create-transient");
  register("defineTransient", "define-transient");
  register("createScoped", "create-scoped");
  register("defineScoped", "define-scoped");

  return bindings;
}

function resolveDependencyExpression(
  dependency: string,
  bindings: ReadonlyMap<string, BindingInfo>
): string {
  const binding = bindings.get(dependency);
  if (!binding) return dependency;

  switch (binding.kind) {
    case "create-singleton":
    case "create-scoped":
      return binding.instanceName;
    case "define-singleton":
      return binding.instanceName;
    case "define-singleton-lazy":
      return `${dependency}()`;
    case "create-transient":
    case "define-transient":
    case "define-scoped":
      return `${dependency}()`;
  }
}

export function resolveDependencies(
  rawDependencies: string,
  bindings: ReadonlyMap<string, BindingInfo>
): string {
  const deps = splitDependencyList(rawDependencies).map((dependency) =>
    resolveDependencyExpression(dependency, bindings)
  );
  return deps.join(", ");
}

export function resolveTeardownResource(
  resource: string,
  bindings: ReadonlyMap<string, BindingInfo>
): { expression: string; awaitExpression: boolean } {
  const binding = bindings.get(resource);
  if (!binding) return { expression: resource, awaitExpression: false };

  switch (binding.kind) {
    case "create-singleton":
    case "create-scoped":
      return { expression: binding.instanceName, awaitExpression: false };
    case "define-singleton":
      return { expression: binding.instanceName, awaitExpression: false };
    case "define-singleton-lazy":
      return { expression: `${binding.peekName}()`, awaitExpression: false };
    case "create-transient":
    case "define-transient":
    case "define-scoped":
      return { expression: `${resource}()`, awaitExpression: false };
  }
}
