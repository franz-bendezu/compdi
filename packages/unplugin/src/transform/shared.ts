import type { ParsedDiOptions } from "./context";

export function splitDependencyList(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function findMatchingParen(source: string, openParenIndex: number): number {
  let depth = 0;

  for (let index = openParenIndex; index < source.length; index += 1) {
    const char = source[index];

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

export function splitTopLevelArgs(source: string): [string, string] | null {
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (char === "(") {
      depthParen += 1;
      continue;
    }

    if (char === ")") {
      depthParen -= 1;
      continue;
    }

    if (char === "[") {
      depthBracket += 1;
      continue;
    }

    if (char === "]") {
      depthBracket -= 1;
      continue;
    }

    if (char === "{") {
      depthBrace += 1;
      continue;
    }

    if (char === "}") {
      depthBrace -= 1;
      continue;
    }

    if (
      char === "," &&
      depthParen === 0 &&
      depthBracket === 0 &&
      depthBrace === 0
    ) {
      const left = source.slice(0, index).trim();
      const right = source.slice(index + 1).trim();
      return [left, right];
    }
  }

  return null;
}

/**
 * Build a TypeScript type annotation string from parsed DiOptions.
 * If `target` is present → `TargetName`.
 * If `factory` is present → `Awaited<ReturnType<typeof factory>>`.
 * Returns empty string when neither is known.
 */
export function buildTypeAnnotation(options: ParsedDiOptions): string {
  if (options.target) return options.target;
  if (options.factory) {
    // Only simple identifiers are safe to reference with typeof
    if (/^[A-Za-z_$][\w$]*$/.test(options.factory)) {
      return `ReturnType<typeof ${options.factory}>`;
    }
  }
  return "";
}

/**
 * Build the instantiation expression from parsed DiOptions.
 * If `target` is present, generates `new Target(deps)`.
 * If `factory` is present, generates `factory(deps)`.
 */
export function buildInstantiation(options: ParsedDiOptions, resolvedDeps: string): string {
  if (options.target) {
    return `new ${options.target}(${resolvedDeps})`;
  }
  if (options.factory) {
    return `(${options.factory})(${resolvedDeps})`;
  }
  throw new Error("[compdi] DiOptions must specify either `target` or `factory`.");
}
