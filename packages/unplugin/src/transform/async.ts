import { findMatchingParen, splitTopLevelArgs } from "./shared";
import { resolveDependencies } from "./context";
import type { BindingInfo, Replacement } from "./types";

export function collectAsyncSingletonReplacements(
  code: string,
  bindings: ReadonlyMap<string, BindingInfo>,
  mode: "create" | "define"
): Replacement[] {
  const replacements: Replacement[] = [];
  const headRegex =
    mode === "create"
      ? /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*createAsyncSingleton\s*\(/g
      : /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*defineAsyncSingleton\s*\(/g;

  let headMatch = headRegex.exec(code);
  while (headMatch) {
    const name = headMatch[1];
    const openParenIndex = headRegex.lastIndex - 1;
    const closeParenIndex = findMatchingParen(code, openParenIndex);

    if (closeParenIndex < 0) {
      headMatch = headRegex.exec(code);
      continue;
    }

    let endIndex = closeParenIndex + 1;
    while (endIndex < code.length && /\s/.test(code[endIndex])) {
      endIndex += 1;
    }
    if (code[endIndex] === ";") {
      endIndex += 1;
    }

    const argsSource = code.slice(openParenIndex + 1, closeParenIndex);
    const args = splitTopLevelArgs(argsSource);
    if (!args) {
      headMatch = headRegex.exec(code);
      continue;
    }

    const [factory, depsExpr] = args;
    const depsMatch = depsExpr.match(/^\[([\s\S]*)\]$/);
    const rawDeps = depsMatch ? depsMatch[1] : "";
    const deps = resolveDependencies(rawDeps, bindings, "async");
    const invokeArgs = deps.trim() ? deps : "";
    const binding = bindings.get(name);
    if (!binding) {
      headMatch = headRegex.exec(code);
      continue;
    }

    replacements.push({
      start: headMatch.index,
      end: endIndex,
      code:
        mode === "create"
          ? `export const ${name} = await (${factory})(${invokeArgs});`
          : [
              `let ${binding.promiseName} = null;`,
              `const ${binding.peekName} = () => ${binding.promiseName};`,
              `export const ${name} = () => {`,
              `  if (!${binding.promiseName}) ${binding.promiseName} = Promise.resolve((${factory})(${invokeArgs}));`,
              `  return ${binding.promiseName};`,
              `};`
            ].join("\n")
    });

    headRegex.lastIndex = endIndex;
    headMatch = headRegex.exec(code);
  }

  return replacements;
}
