import type { Span } from "oxc-parser";
import type { MacroMatch, ParsedDiOptions, TransformContext } from "./context";

export interface MacroGenerationContext {
  module: TransformContext;
  uninitialized: string;
  renderNode(node: Span): string;
  instantiate(options: ParsedDiOptions): string;
  instantiateContextual(options: ParsedDiOptions, contextExpression: string): string;
  typeArg(match: MacroMatch, index: number): string | undefined;
  typeAnnotation(options: ParsedDiOptions, awaited?: boolean): string;
  nextUnique(): number;
}
