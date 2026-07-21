import type { MacroMatch } from "./context";
import type { MacroGenerationContext } from "./generation";

export function generateTransientExpression(match: MacroMatch, generation: MacroGenerationContext): string {
  return `() => ${generation.instantiate(match.options!)}`;
}

export function generateTransientDeclaration(match: MacroMatch, generation: MacroGenerationContext): string {
  return `${match.exported ? "export " : ""}const ${match.name} = ${generateTransientExpression(match, generation)};`;
}
