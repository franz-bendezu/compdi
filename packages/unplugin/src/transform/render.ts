import type MagicString from "magic-string";
import type { Span } from "oxc-parser";
import type { DeclarationMacroMatch, MacroMatch, ParsedDiOptions, TransformContext } from "./context";
import { hasMacroOptions, isDeclarationMacro, resolveDependencyExpression } from "./context";
import type { MacroGenerationContext } from "./generation";
import { generateScopedDeclaration, generateScopedExpression } from "./scoped";
import { generateSingletonDeclaration, generateSingletonExpression } from "./singletons";
import { generateTeardownDeclaration, generateTeardownExpression } from "./teardown";
import { generateTransientDeclaration, generateTransientExpression } from "./transient";

export function collectMacroReplacements(context: TransformContext, ms: MagicString): boolean {
  if (!context.matches.length) return false;
  let unique = 0;
  const sourceIdentifiers = context.sourceIdentifiers;
  let uninitialized = "__compdi_uninitialized";
  while (sourceIdentifiers.has(uninitialized)) uninitialized += "_";
  const nextUnique = (): number => {
    while ([
      `__compdi_value_${unique}`, `compdi_${unique}`, `scope_${unique}`,
      `__compdi_ctx_${unique}`, `__resource_${unique}`
    ].some((name) => sourceIdentifiers.has(name))) unique += 1;
    return unique++;
  };

  const sortedMatches = [...context.matches].sort((a, b) => a.start - b.start || b.end - a.end);
  const children = new Map<MacroMatch, MacroMatch[]>();
  const roots: MacroMatch[] = [];
  const stack: MacroMatch[] = [];
  for (const match of sortedMatches) {
    while (stack.length) {
      const parent = stack.at(-1)!;
      if (parent.start <= match.start && parent.end >= match.end) break;
      stack.pop();
    }
    const parent = stack.at(-1);
    if (parent) {
      const entries = children.get(parent);
      if (entries) entries.push(match);
      else children.set(parent, [match]);
    } else {
      roots.push(match);
    }
    stack.push(match);
  }

  let activeMatch: MacroMatch | undefined;

  const renderRange = (start: number, end: number): string => {
    const nested = (activeMatch ? children.get(activeMatch) ?? [] : roots)
      .filter((match) => match.start >= start && match.end <= end);
    if (!nested.length) return context.code.slice(start, end);
    let output = "";
    let cursor = start;
    for (const child of nested) {
      output += context.code.slice(cursor, child.start) + replacementFor(child);
      cursor = child.end;
    }
    return output + context.code.slice(cursor, end);
  };
  const renderNode = (node: Span): string => renderRange(node.start, node.end);
  const typeArg = (match: MacroMatch, index: number): string | undefined => {
    const argument = match.typeArgs[index];
    return argument ? renderNode(argument) : undefined;
  };
  const deps = (options: ParsedDiOptions): string => options.deps.map((node) => {
    const raw = renderNode(node);
    if (!activeMatch) throw new Error("[compdi] Missing active macro during dependency generation");
    return resolveDependencyExpression(node.type === "Identifier" ? node.name : raw, activeMatch, context);
  }).join(", ");
  const instantiate = (options: ParsedDiOptions): string => {
    const args = deps(options);
    if (options.target) return `new ${renderNode(options.target)}(${args})`;
    if (options.factory) return `(${renderNode(options.factory)})(${args})`;
    throw new Error("unreachable");
  };
  const instantiateContextual = (options: ParsedDiOptions, contextExpression: string): string => {
    const args = deps(options);
    if (options.target) return `new ${renderNode(options.target)}(${args})`;
    if (options.factory) {
      const factoryArgs = args ? `${contextExpression}, ${args}` : contextExpression;
      return `(${renderNode(options.factory)})(${factoryArgs})`;
    }
    throw new Error("unreachable");
  };
  const typeAnnotation = (options: ParsedDiOptions, awaited = false): string => {
    if (options.target?.type === "Identifier") return options.target.name;
    if (options.factory?.type === "Identifier") {
      const inner = `ReturnType<typeof ${options.factory.name}>`;
      return awaited ? `Awaited<${inner}>` : inner;
    }
    return "";
  };
  const generation: MacroGenerationContext = {
    module: context,
    uninitialized,
    renderNode,
    instantiate,
    instantiateContextual,
    typeArg,
    typeAnnotation,
    nextUnique
  };

  if (context.matches.some((match) => match.macroName === "defineSingleton" && match.options?.lazy)) {
    const symbolType = /\.[cm]?tsx?$/.test(context.id) ? ": unique symbol" : "";
    ms.prepend(`const ${uninitialized}${symbolType} = Symbol();\n`);
  }

  const expressionFor = (match: MacroMatch): string => {
    if (match.macroName === "defineAppTeardown") return generateTeardownExpression(match, generation);
    if (!hasMacroOptions(match)) throw new Error(`[compdi] Missing options for ${match.macroName}`);
    switch (match.macroName) {
      case "createSingleton": case "defineSingleton": return generateSingletonExpression(match, generation);
      case "createTransient": case "defineTransient": return generateTransientExpression(match, generation);
      case "createScoped": case "defineScoped": return generateScopedExpression(match, generation);
    }
  };

  const declarationFor = (match: DeclarationMacroMatch): string => {
    if (match.macroName === "defineAppTeardown") return generateTeardownDeclaration(match, generation);
    if (!hasMacroOptions(match)) throw new Error(`[compdi] Missing options for ${match.macroName}`);
    switch (match.macroName) {
      case "createSingleton": case "defineSingleton": return generateSingletonDeclaration(match, generation);
      case "createTransient": case "defineTransient": return generateTransientDeclaration(match, generation);
      case "createScoped": case "defineScoped": return generateScopedDeclaration(match, generation);
    }
  };

  function replacementFor(match: MacroMatch): string {
    const previous = activeMatch;
    activeMatch = match;
    try {
      return isDeclarationMacro(match) ? declarationFor(match) : expressionFor(match);
    } finally {
      activeMatch = previous;
    }
  }

  for (const match of roots) ms.overwrite(match.start, match.end, replacementFor(match));
  return true;
}
