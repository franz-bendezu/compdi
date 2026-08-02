import { parseSync, visitorKeys } from "oxc-parser";
import type {
  ArrowFunctionExpression,
  CallExpression,
  Expression,
  Function as OxcFunction,
  ImportDeclaration,
  ImportSpecifier,
  Node,
  ObjectProperty,
  Program,
  TSType,
  VariableDeclaration
} from "oxc-parser";
import type { BindingInfo, BindingKind } from "./types";

export const MACRO_NAMES = [
  "createSingleton", "defineSingleton", "createTransient", "defineTransient",
  "createScoped", "defineScoped", "defineAppTeardown"
] as const;
export type MacroName = typeof MACRO_NAMES[number];
const MACROS = new Set<string>(MACRO_NAMES);
const MODULES = new Set(["@compdi/core", "compdi/macros", "compdi"]);

export interface ParsedDiOptions {
  target?: Expression;
  factory?: Expression;
  deps: Expression[];
  lazy: boolean;
  context?: Expression;
  onRelease?: Expression;
}

interface MacroMatchBase {
  localName: string;
  name?: string;
  exported: boolean;
  scopeName?: string;
  options?: ParsedDiOptions;
  resources?: Expression[];
  hasAwait: boolean;
  typeArgs: TSType[];
  call: CallExpression;
  replaceNode: Node;
  declaration?: Node;
  start: number;
  end: number;
}

export type MacroMatch = {
  [Name in MacroName]: MacroMatchBase & { macroName: Name }
}[MacroName];

type OptionsMacroName = Exclude<MacroName, "defineAppTeardown">;

export type OptionsMacroMatch<Name extends OptionsMacroName = OptionsMacroName> =
  Extract<MacroMatch, { macroName: Name }> & {
  options: ParsedDiOptions;
  };

export type DeclarationMacroMatch<Match extends MacroMatch = MacroMatch> = Match & {
  name: string;
  declaration: Node;
};

export function hasMacroOptions(match: MacroMatch): match is OptionsMacroMatch {
  return match.macroName !== "defineAppTeardown" && match.options !== undefined;
}

export function isDeclarationMacro(match: MacroMatch): match is DeclarationMacroMatch {
  return match.name !== undefined && match.declaration !== undefined;
}

export interface MacroImport {
  node: ImportDeclaration;
  specifiers: ImportDeclaration["specifiers"];
  macroSpecifiers: ImportSpecifier[];
}

export interface TransformContext {
  code: string;
  id: string;
  program: Program;
  matches: MacroMatch[];
  imports: MacroImport[];
  bindings: Map<string, BindingInfo>;
}

function diagnostic(id: string, code: string, node: Node, macro: string, message: string): Error {
  const before = code.slice(0, node.start);
  const line = before.split("\n").length;
  const column = node.start - before.lastIndexOf("\n");
  return new Error(`[compdi] ${macro} at ${id}:${line}:${column}: ${message}`);
}

function staticKey(property: ObjectProperty): string | undefined {
  if (property.computed) return undefined;
  if (property.key?.type === "Identifier") return property.key.name;
  if (property.key.type === "Literal" && typeof property.key.value === "string") return property.key.value;
  return undefined;
}

function parseOptions(id: string, code: string, macro: string, call: CallExpression): ParsedDiOptions {
  if (call.arguments.length !== 1 || call.arguments[0]?.type !== "ObjectExpression") {
    throw diagnostic(id, code, call, macro, "expected exactly one object-literal argument");
  }
  const object = call.arguments[0];
  const values = new Map<string, Expression>();
  for (const property of object.properties) {
    if (property.type === "SpreadElement") {
      throw diagnostic(id, code, property, macro, "object spreads are not supported");
    }
    const key = staticKey(property);
    if (!key) throw diagnostic(id, code, property, macro, "computed option keys are not supported");
    if (!["target", "factory", "deps", "lazy", "context", "onRelease"].includes(key)) {
      throw diagnostic(id, code, property, macro, `unknown option \`${key}\``);
    }
    if (values.has(key)) throw diagnostic(id, code, property, macro, `duplicate option \`${key}\``);
    values.set(key, property.value);
  }
  const deps = values.get("deps");
  if (deps && deps.type !== "ArrayExpression") {
    throw diagnostic(id, code, deps, macro, "`deps` must be an array literal");
  }
  if (deps?.elements.some((node) => node === null)) {
    throw diagnostic(id, code, deps, macro, "dependency array holes are not supported");
  }
  const depElements = deps ? deps.elements.filter((node) => node !== null) : [];
  const spread = depElements.find((node) => node.type === "SpreadElement");
  if (spread) throw diagnostic(id, code, spread, macro, "dependency spreads are not supported");
  const depNodes = depElements.filter((node): node is Expression => node.type !== "SpreadElement");
  const lazyNode = values.get("lazy");
  if (lazyNode && (lazyNode.type !== "Literal" || typeof lazyNode.value !== "boolean")) {
    throw diagnostic(id, code, lazyNode, macro, "`lazy` must be a boolean literal");
  }
  const lazy = lazyNode?.type === "Literal" && lazyNode.value === true;
  const hasTarget = values.has("target");
  const hasFactory = values.has("factory");
  if (hasTarget === hasFactory) {
    throw diagnostic(id, code, object, macro, "options must specify exactly one of `target` or `factory`");
  }
  if (lazyNode && macro !== "defineSingleton") {
    throw diagnostic(id, code, lazyNode, macro, "`lazy` is supported only by `defineSingleton`");
  }
  if (values.has("context") && macro !== "createScoped") {
    throw diagnostic(id, code, values.get("context")!, macro, "`context` is supported only by `createScoped`");
  }
  if (macro === "createScoped" && !values.has("context")) {
    throw diagnostic(id, code, object, macro, "`context` is required by `createScoped`");
  }
  if (values.has("onRelease") && macro !== "createScoped" && macro !== "defineScoped") {
    throw diagnostic(id, code, values.get("onRelease")!, macro, "`onRelease` is supported only by scoped macros");
  }
  return {
    target: values.get("target"), factory: values.get("factory"), deps: depNodes,
    lazy, context: values.get("context"), onRelease: values.get("onRelease")
  };
}

function patternNames(pattern: Node | null | undefined, names: Set<string>): void {
  if (!pattern) return;
  if (pattern.type === "Identifier") names.add(pattern.name);
  else if (pattern.type === "RestElement") patternNames(pattern.argument, names);
  else if (pattern.type === "AssignmentPattern") patternNames(pattern.left, names);
  else if (pattern.type === "ArrayPattern") for (const item of pattern.elements) patternNames(item, names);
  else if (pattern.type === "ObjectPattern") for (const p of pattern.properties) patternNames(p.value ?? p.argument, names);
  else if (pattern.type === "TSParameterProperty") patternNames(pattern.parameter, names);
}

function isFunctionLike(node: Node): node is OxcFunction | ArrowFunctionExpression {
  return node.type === "FunctionDeclaration" || node.type === "FunctionExpression" ||
    node.type === "TSDeclareFunction" || node.type === "TSEmptyBodyFunctionExpression" ||
    node.type === "ArrowFunctionExpression";
}

function scopeBindings(node: Node): Set<string> {
  const names = new Set<string>();
  if (isFunctionLike(node)) {
    for (const param of node.params) patternNames(param, names);
    if (node.id) patternNames(node.id, names);
  }
  const body = node.type === "Program" || node.type === "BlockStatement"
    ? node.body
    : isFunctionLike(node) && node.body?.type === "BlockStatement" ? node.body.body : [];
  for (const statement of body) {
    const decl = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (decl?.type === "VariableDeclaration") for (const d of decl.declarations) patternNames(d.id, names);
    else if (decl?.type === "FunctionDeclaration" || decl?.type === "ClassDeclaration") patternNames(decl.id, names);
  }
  return names;
}

function nodeChildren(node: Node): Node[] {
  const children: Node[] = [];
  for (const key of visitorKeys[node.type] ?? []) {
    const value: unknown = Reflect.get(node, key);
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) children.push(item);
    } else if (isNode(value)) {
      children.push(value);
    }
  }
  return children;
}

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && "type" in value &&
    typeof Reflect.get(value, "type") === "string" &&
    typeof Reflect.get(value, "start") === "number" && typeof Reflect.get(value, "end") === "number";
}

function isMacroName(value: string): value is MacroName {
  return MACROS.has(value);
}

function createBindingInfo(name: string, kind: BindingKind): BindingInfo {
  switch (kind) {
    case "create-singleton": case "create-transient": case "create-scoped": return { kind, instanceName: name };
    case "define-singleton": return { kind, instanceName: `__${name}` };
    case "define-singleton-lazy": return { kind, instanceName: `__lazy_${name}`, peekName: `__peek_${name}` };
    case "define-transient": case "define-scoped": return { kind, instanceName: name };
  }
}

export function analyzeModule(code: string, id: string): TransformContext | null {
  const parsed = parseSync(id, code, { showSemanticErrors: false, astType: "ts" });
  if (parsed.errors.length) {
    const first = parsed.errors[0];
    const detail = first?.codeframe ? `\n${first.codeframe}` : "";
    throw new Error(`[compdi] Failed to parse ${id}: ${first?.message ?? "unknown syntax error"}${detail}`);
  }
  const program = parsed.program;
  const localMacros = new Map<string, MacroName>();
  const imports: MacroImport[] = [];
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration" || !MODULES.has(statement.source.value)) continue;
    const macroSpecifiers: ImportSpecifier[] = [];
    for (const specifier of statement.specifiers) {
      if (specifier.type !== "ImportSpecifier") continue;
      const imported = specifier.imported.type === "Identifier"
        ? specifier.imported.name
        : specifier.imported.value;
      if (!isMacroName(imported)) continue;
      localMacros.set(specifier.local.name, imported);
      macroSpecifiers.push(specifier);
    }
    if (macroSpecifiers.length) imports.push({ node: statement, specifiers: statement.specifiers, macroSpecifiers });
  }
  if (!localMacros.size) return { code, id, program, matches: [], imports, bindings: new Map() };

  const matches: MacroMatch[] = [];
  const scopes: Set<string>[] = [];
  const ancestors: Node[] = [];
  const visit = (node: Node): void => {
    const opensScope = node.type === "Program" || node.type === "BlockStatement" || isFunctionLike(node);
    if (opensScope) scopes.push(scopeBindings(node));
    if (node.type === "CallExpression" && node.callee?.type === "Identifier") {
      const localName = node.callee.name;
      const macroName = localMacros.get(localName);
      // The program binding is the import itself; only nested lexical bindings shadow it.
      const shadowed = scopes.slice(1).some((scope) => scope.has(localName));
      if (macroName && !shadowed) {
        const parent = ancestors.at(-1);
        const awaitNode = parent?.type === "AwaitExpression" && parent.argument === node ? parent : undefined;
        const replaceNode = awaitNode ?? node;
        const declarator = [...ancestors].reverse().find((a) => a.type === "VariableDeclarator");
        let declarationIndex = ancestors.length - 1;
        while (declarationIndex >= 0 && ancestors[declarationIndex].type !== "VariableDeclaration") declarationIndex -= 1;
        const declarationCandidate = declarationIndex >= 0 ? ancestors[declarationIndex] : undefined;
        const declaration: VariableDeclaration | undefined = declarationCandidate?.type === "VariableDeclaration"
          ? declarationCandidate
          : undefined;
        const exportNode = declarationIndex > 0 && ancestors[declarationIndex - 1].type === "ExportNamedDeclaration"
          ? ancestors[declarationIndex - 1]
          : undefined;
        const direct = declarator && declaration?.kind === "const" && declaration.declarations.length === 1 && (declarator.init === node || declarator.init === awaitNode);
        let name: string | undefined;
        let scopeName: string | undefined;
        if (direct && declarator.id.type === "Identifier") name = declarator.id.name;
        else if (direct && macroName === "createScoped" && declarator.id.type === "ArrayPattern" && declarator.id.elements.length === 2 && declarator.id.elements.every((x) => x?.type === "Identifier")) {
          const [valueBinding, scopeBinding] = declarator.id.elements;
          if (valueBinding?.type === "Identifier" && scopeBinding?.type === "Identifier") {
            name = valueBinding.name; scopeName = scopeBinding.name;
          }
        }
        const isTeardown = macroName === "defineAppTeardown";
        let options: ParsedDiOptions | undefined;
        let resources: Expression[] | undefined;
        if (isTeardown) {
          if (node.arguments.length !== 1 || node.arguments[0]?.type !== "ArrayExpression") throw diagnostic(id, code, node, macroName, "expected exactly one array-literal argument");
          const resourceNodes = node.arguments[0].elements.filter((item) => item !== null);
          if (resourceNodes.some((item) => item.type === "SpreadElement")) throw diagnostic(id, code, node, macroName, "resource spreads are not supported");
          resources = resourceNodes.filter((item): item is Expression => item.type !== "SpreadElement");
        } else options = parseOptions(id, code, macroName, node);
        const declarationNode = name ? (exportNode ?? declaration) : undefined;
        matches.push({
          macroName, localName, name, scopeName, options, resources, hasAwait: Boolean(awaitNode),
          typeArgs: node.typeArguments?.params ?? [], call: node, replaceNode,
          declaration: declarationNode, start: declarationNode?.start ?? replaceNode.start, end: declarationNode?.end ?? replaceNode.end,
          exported: Boolean(exportNode)
        });
      }
    }
    ancestors.push(node);
    for (const child of nodeChildren(node)) visit(child);
    ancestors.pop();
    if (opensScope) scopes.pop();
  };
  visit(program);

  const bindings = new Map<string, BindingInfo>();
  for (const match of matches) {
    if (!match.name || !match.declaration) continue;
    const kind = bindingKindFor(match);
    if (!kind) continue;
    bindings.set(match.name, createBindingInfo(match.name, kind));
  }
  return { code, id, program, matches, imports, bindings };
}

function bindingKindFor(match: MacroMatch): BindingKind | undefined {
  switch (match.macroName) {
    case "createSingleton": return "create-singleton";
    case "defineSingleton": return match.options?.lazy ? "define-singleton-lazy" : "define-singleton";
    case "createTransient": return "create-transient";
    case "defineTransient": return "define-transient";
    case "createScoped": return "create-scoped";
    case "defineScoped": return "define-scoped";
    case "defineAppTeardown": return undefined;
  }
}

export function resolveDependencyExpression(dependency: string, bindings: ReadonlyMap<string, BindingInfo>): string {
  const binding = bindings.get(dependency);
  if (!binding) return dependency;
  switch (binding.kind) {
    case "create-singleton": case "create-scoped": case "define-singleton": return binding.instanceName;
    case "define-singleton-lazy": return `${dependency}()`;
    case "create-transient": case "define-transient": case "define-scoped": return `${dependency}()`;
  }
}

export function resolveTeardownResource(resource: string, bindings: ReadonlyMap<string, BindingInfo>): { expression: string; awaitExpression: boolean } {
  const binding = bindings.get(resource);
  if (!binding) return { expression: resource, awaitExpression: false };
  switch (binding.kind) {
    case "create-singleton": case "create-scoped": case "define-singleton": return { expression: binding.instanceName, awaitExpression: false };
    case "define-singleton-lazy": return { expression: `${binding.peekName}()`, awaitExpression: false };
    case "create-transient": case "define-transient": case "define-scoped": return { expression: `${resource}()`, awaitExpression: false };
  }
}
