import type { DeclarationMacroMatch, OptionsMacroMatch } from "./context";
import type { MacroGenerationContext } from "./generation";

type SingletonMatch = OptionsMacroMatch<"createSingleton" | "defineSingleton">;

export function generateSingletonExpression(match: SingletonMatch, generation: MacroGenerationContext): string {
  const options = match.options;
  const expression = generation.instantiate(options);
  if (match.macroName === "createSingleton") return match.hasAwait ? `await ${expression}` : expression;

  const suffix = generation.nextUnique();
  const value = `__compdi_value_${suffix}`;
  if (options.lazy) return `(() => { let ${value} = null; return () => { if (!${value}) ${value} = ${expression}; return ${value}; }; })()`;
  if (match.hasAwait) return `await (async () => { const ${value} = await ${expression}; return () => ${value}; })()`;
  return `(() => { const ${value} = ${expression}; return () => ${value}; })()`;
}

export function generateSingletonDeclaration(match: SingletonMatch & DeclarationMacroMatch, generation: MacroGenerationContext): string {
  const visibility = match.exported ? "export " : "";
  const name = match.name;
  const options = match.options;
  const expression = generation.instantiate(options);
  if (match.macroName === "createSingleton") {
    return `${visibility}const ${name} = ${match.hasAwait ? `await ${expression}` : expression};`;
  }

  const binding = generation.module.bindings.get(name);
  if (!binding) throw new Error(`[compdi] Missing binding metadata for ${name}`);
  if (options.lazy) {
    const annotation = generation.typeAnnotation(options);
    const typed = annotation ? `let ${binding.instanceName}: ${annotation} | null = null;` : `let ${binding.instanceName} = null;`;
    return [typed, `const ${binding.peekName} = () => ${binding.instanceName};`, `${visibility}const ${name} = () => {`, `  if (!${binding.instanceName}) ${binding.instanceName} = ${expression};`, `  return ${binding.instanceName};`, `};`].join("\n");
  }
  const rhs = match.hasAwait ? `await ${expression}` : expression;
  const annotation = generation.typeAnnotation(options, match.hasAwait);
  const typed = annotation ? `const ${binding.instanceName}: ${annotation} = ${rhs};` : `const ${binding.instanceName} = ${rhs};`;
  return `${typed}\n${visibility}const ${name} = () => ${binding.instanceName};`;
}
