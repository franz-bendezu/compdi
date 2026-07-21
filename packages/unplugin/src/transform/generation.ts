import type { Span } from "oxc-parser";
import type { MacroMatch, ParsedDiOptions, TransformContext } from "./context";

export interface MacroGenerationContext {
  module: TransformContext;
  renderNode(node: Span): string;
  instantiate(options: ParsedDiOptions): string;
  typeArg(match: MacroMatch, index: number): string | undefined;
  typeAnnotation(options: ParsedDiOptions, awaited?: boolean): string;
  nextUnique(): number;
}
