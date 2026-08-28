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
  VariableDeclaration,
  VariableDeclarator
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
  topLevel: boolean;
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
  sourceIdentifiers: Set<string>;
}

interface DependencyGraphNode {
  match: DeclarationMacroMatch;
  binding: BindingInfo;
  dependencies: DependencyGraphEdge[];
  eager: boolean;
  lazy: boolean;
  declarationStart: number;
}

interface DependencyGraphEdge {
  dependency: string;
  expression: Expression;
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
  if (lazyNode && macro !== "createSingleton" && macro !== "defineSingleton") {
    throw diagnostic(id, code, lazyNode, macro, "`lazy` is supported only by singleton macros");
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

function visitNodeChildren(node: Node, visit: (child: Node) => void): void {
  for (const key of visitorKeys[node.type] ?? []) {
    const value: unknown = Reflect.get(node, key);
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) visit(item);
    } else if (isNode(value)) {
      visit(value);
    }
  }
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
  if (!localMacros.size) {
    return { code, id, program, matches: [], imports, bindings: new Map(), sourceIdentifiers: new Set() };
  }

  const matches: MacroMatch[] = [];
  const sourceIdentifiers = new Set<string>();
  const shadowCounts = new Map<string, number>();
  interface TraversalState {
    parent?: Node;
    declarator?: VariableDeclarator;
    declaration?: VariableDeclaration;
    exportNode?: Node;
    functionDepth: number;
    blockDepth: number;
  }
  const visit = (node: Node, state: TraversalState): void => {
    if (node.type === "Identifier") sourceIdentifiers.add(node.name);
    const opensScope = node.type === "Program" || node.type === "BlockStatement" || isFunctionLike(node);
    const scope = opensScope ? scopeBindings(node) : undefined;
    if (scope && node.type !== "Program") {
      for (const name of scope) {
        if (localMacros.has(name)) shadowCounts.set(name, (shadowCounts.get(name) ?? 0) + 1);
      }
    }
    if (node.type === "CallExpression" && node.callee?.type === "Identifier") {
      const localName = node.callee.name;
      const macroName = localMacros.get(localName);
      const shadowed = (shadowCounts.get(localName) ?? 0) > 0;
      if (macroName && !shadowed) {
        const parent = state.parent;
        const awaitNode = parent?.type === "AwaitExpression" && parent.argument === node ? parent : undefined;
        const replaceNode = awaitNode ?? node;
        const declarator = state.declarator;
        const declaration = state.declaration;
        const exportNode = state.exportNode?.type === "ExportNamedDeclaration" &&
          state.exportNode.declaration === declaration ? state.exportNode : undefined;
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
          exported: Boolean(exportNode),
          topLevel: state.functionDepth === 0 && state.blockDepth === 0
        });
      }
    }
    const nextState: TraversalState = {
      parent: node,
      declarator: node.type === "VariableDeclarator" ? node : state.declarator,
      declaration: node.type === "VariableDeclaration" ? node : state.declaration,
      exportNode: node.type === "ExportNamedDeclaration" ? node : state.exportNode,
      functionDepth: state.functionDepth + (isFunctionLike(node) ? 1 : 0),
      blockDepth: state.blockDepth + (node.type === "BlockStatement" ? 1 : 0)
    };
    visitNodeChildren(node, (child) => visit(child, nextState));
    if (scope && node.type !== "Program") {
      for (const name of scope) {
        if (!localMacros.has(name)) continue;
        const count = (shadowCounts.get(name) ?? 1) - 1;
        if (count === 0) shadowCounts.delete(name);
        else shadowCounts.set(name, count);
      }
    }
  };
  visit(program, { functionDepth: 0, blockDepth: 0 });

  const bindings = new Map<string, BindingInfo>();
  for (const match of matches) {
    if (!match.name || !match.declaration) continue;
    const kind = bindingKindFor(match);
    if (!kind) continue;
    bindings.set(match.name, createBindingInfo(match.name, kind));
  }
  validateDependencyGraph(id, code, matches);
  return { code, id, program, matches, imports, bindings, sourceIdentifiers };
}

function validateDependencyGraph(
  id: string,
  code: string,
  matches: readonly MacroMatch[]
): void {
  const nodes = new Map<string, DependencyGraphNode>();
  for (const match of matches) {
    if (!match.topLevel || !isDeclarationMacro(match) || !hasMacroOptions(match)) continue;
    const kind = bindingKindFor(match);
    if (!kind) continue;
    nodes.set(match.name, {
      match,
      binding: createBindingInfo(match.name, kind),
      dependencies: match.options.deps
        .flatMap((dependency) => dependency.type === "Identifier"
          ? [{ dependency: dependency.name, expression: dependency }]
          : []),
      eager: match.macroName === "createSingleton" ||
        (match.macroName === "defineSingleton" && !match.options.lazy),
      lazy: match.options.lazy,
      declarationStart: match.start
    });
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];
  const visit = (name: string): void => {
    if (visited.has(name)) return;
    const node = nodes.get(name);
    if (!node) return;
    visiting.add(name);
    path.push(name);
    for (const edge of node.dependencies) {
      if (!nodes.has(edge.dependency)) continue;
      if (visiting.has(edge.dependency)) {
        const cycleStart = path.indexOf(edge.dependency);
        const cycle = [...path.slice(cycleStart), edge.dependency];
        throw diagnostic(id, code, edge.expression, node.match.macroName,
          `dependency cycle detected: ${cycle.join(" -> ")}`);
      }
      visit(edge.dependency);
    }
    path.pop();
    visiting.delete(name);
    visited.add(name);
  };
  for (const name of nodes.keys()) visit(name);

  for (const node of nodes.values()) {
    if (!node.eager) continue;
    for (const edge of node.dependencies) {
      const target = nodes.get(edge.dependency);
      if (target && target.declarationStart > node.declarationStart) {
        throw diagnostic(id, code, edge.expression, node.match.macroName,
          `eager dependency \`${edge.dependency}\` is declared after \`${node.match.name}\``);
      }
    }
  }
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
