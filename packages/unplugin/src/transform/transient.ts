import type { DeclarationMacroMatch, OptionsMacroMatch } from "./context";
import type { MacroGenerationContext } from "./generation";

type TransientMatch = OptionsMacroMatch<"createTransient" | "defineTransient">;

export function generateTransientExpression(match: TransientMatch, generation: MacroGenerationContext): string {
  return `() => ${generation.instantiate(match.options)}`;
}

export function generateTransientDeclaration(match: TransientMatch & DeclarationMacroMatch, generation: MacroGenerationContext): string {
  return `${match.exported ? "export " : ""}const ${match.name} = ${generateTransientExpression(match, generation)};`;
}
