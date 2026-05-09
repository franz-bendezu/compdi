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

export function resolveDependencyExpression(
  dependency: string,
  singletonBindings: ReadonlySet<string>
): string {
  if (singletonBindings.has(dependency)) {
    return `__${dependency}`;
  }

  return dependency;
}

export function resolveDependencies(
  rawDependencies: string,
  singletonBindings: ReadonlySet<string>
): string {
  const deps = splitDependencyList(rawDependencies).map((dep) =>
    resolveDependencyExpression(dep, singletonBindings)
  );

  return deps.join(", ");
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
