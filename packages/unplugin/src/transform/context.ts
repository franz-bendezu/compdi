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
  scopeId: number;
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
  scopes: LexicalScope[];
  bindings: Map<MacroMatch, DiBindingRecord>;
  sourceIdentifiers: Set<string>;
}

type ScopeKind =
  | "program"
  | "function"
  | "function-body"
  | "class"
  | "block"
  | "catch"
  | "loop"
  | "switch"
  | "static-block"
  | "module-block";

export interface LexicalScope {
  id: number;
  parentId?: number;
  kind: ScopeKind;
  start: number;
  end: number;
  declaredNames: Set<string>;
  bindings: Map<string, DiBindingRecord>;
}

export interface DiBindingRecord {
  info: BindingInfo;
  match: DeclarationMacroMatch;
  scopeId: number;
}

interface MacroCandidate {
  macroName: MacroName;
  localName: string;
  call: CallExpression;
  scopeId: number;
  parent?: Node;
  declarator?: VariableDeclarator;
  declaration?: VariableDeclaration;
  exportNode?: Node;
}

interface DependencyGraphNode {
  match: DeclarationMacroMatch;
  binding: DiBindingRecord;
  dependencies: DependencyGraphEdge[];
  eager: boolean;
  lazy: boolean;
  declarationStart: number;
}

interface DependencyGraphEdge {
  dependency: string;
  expression: Expression;
  target: DeclarationMacroMatch;
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

function scopeKind(node: Node, parent: Node | undefined): ScopeKind | undefined {
  if (node.type === "Program") return "program";
  if (isFunctionLike(node)) return "function";
  if (node.type === "ClassDeclaration" || node.type === "ClassExpression") return "class";
  if (node.type === "CatchClause") return "catch";
  if (node.type === "ForStatement" || node.type === "ForInStatement" || node.type === "ForOfStatement") return "loop";
  if (node.type === "SwitchStatement") return "switch";
  if (node.type === "StaticBlock") return "static-block";
  if (node.type === "TSModuleBlock") return "module-block";
  if (node.type === "BlockStatement") {
    return parent && isFunctionLike(parent) && parent.body === node ? "function-body" : "block";
  }
  return undefined;
}

function addPatternToScope(scopes: LexicalScope[], scopeId: number | undefined, pattern: Node | null | undefined): void {
  if (scopeId === undefined) return;
  patternNames(pattern, scopes[scopeId].declaredNames);
}

function nearestVarScope(scopes: LexicalScope[], scopeId: number): number {
  let scope = scopes[scopeId];
  while (scope.kind !== "function-body" && scope.kind !== "program" &&
    scope.kind !== "static-block" && scope.kind !== "module-block") {
    if (scope.parentId === undefined) return scope.id;
    scope = scopes[scope.parentId];
  }
  return scope.id;
}

function registerNodeBindings(
  node: Node,
  scopes: LexicalScope[],
  scopeId: number,
  parentScopeId: number | undefined
): void {
  if (node.type === "ImportDeclaration") {
    for (const specifier of node.specifiers) addPatternToScope(scopes, scopeId, specifier.local);
  } else if (node.type === "VariableDeclaration") {
    const declarationScope = node.kind === "var" ? nearestVarScope(scopes, scopeId) : scopeId;
    for (const declarator of node.declarations) addPatternToScope(scopes, declarationScope, declarator.id);
  } else if (node.type === "FunctionDeclaration") {
    addPatternToScope(scopes, parentScopeId, node.id);
    addPatternToScope(scopes, scopeId, node.id);
  } else if (node.type === "FunctionExpression") {
    addPatternToScope(scopes, scopeId, node.id);
  } else if (node.type === "ClassDeclaration") {
    addPatternToScope(scopes, parentScopeId, node.id);
    addPatternToScope(scopes, scopeId, node.id);
  } else if (node.type === "ClassExpression") {
    addPatternToScope(scopes, scopeId, node.id);
  } else if (node.type === "TSEnumDeclaration" || node.type === "TSModuleDeclaration") {
    addPatternToScope(scopes, scopeId, node.id);
  }

  if (isFunctionLike(node)) {
    for (const param of node.params) addPatternToScope(scopes, scopeId, param);
  } else if (node.type === "CatchClause") {
    addPatternToScope(scopes, scopeId, node.param);
  }
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
    return { code, id, program, matches: [], imports, scopes: [], bindings: new Map(), sourceIdentifiers: new Set() };
  }

  const candidates: MacroCandidate[] = [];
  const scopes: LexicalScope[] = [];
  const sourceIdentifiers = new Set<string>();
  interface TraversalState {
    parent?: Node;
    declarator?: VariableDeclarator;
    declaration?: VariableDeclaration;
    exportNode?: Node;
    scopeId?: number;
  }
  const visit = (node: Node, state: TraversalState): void => {
    if (node.type === "Identifier") sourceIdentifiers.add(node.name);
    const kind = scopeKind(node, state.parent);
    let scopeId = state.scopeId;
    if (kind) {
      scopeId = scopes.length;
      scopes.push({
        id: scopeId,
        parentId: state.scopeId,
        kind,
        start: node.start,
        end: node.end,
        declaredNames: new Set(),
        bindings: new Map()
      });
    }
    if (scopeId === undefined) throw new Error("[compdi] Missing lexical scope during AST traversal");
    registerNodeBindings(node, scopes, scopeId, state.scopeId);
    if (node.type === "CallExpression" && node.callee?.type === "Identifier") {
      const localName = node.callee.name;
      const macroName = localMacros.get(localName);
      if (macroName) candidates.push({
        macroName,
        localName,
        call: node,
        scopeId,
        parent: state.parent,
        declarator: state.declarator,
        declaration: state.declaration,
        exportNode: state.exportNode
      });
    }
    const nextState: TraversalState = {
      parent: node,
      declarator: node.type === "VariableDeclarator" ? node : state.declarator,
      declaration: node.type === "VariableDeclaration" ? node : state.declaration,
      exportNode: node.type === "ExportNamedDeclaration" ? node : state.exportNode,
      scopeId
    };
    visitNodeChildren(node, (child) => visit(child, nextState));
  };
  visit(program, {});

  const matches: MacroMatch[] = [];
  for (const candidate of candidates) {
    let lookupScope: LexicalScope | undefined = scopes[candidate.scopeId];
    let shadowed = false;
    while (lookupScope && lookupScope.kind !== "program") {
      if (lookupScope.declaredNames.has(candidate.localName)) {
        shadowed = true;
        break;
      }
      lookupScope = lookupScope.parentId === undefined ? undefined : scopes[lookupScope.parentId];
    }
    if (shadowed) continue;

    const { macroName, localName, call } = candidate;
    const awaitNode = candidate.parent?.type === "AwaitExpression" && candidate.parent.argument === call
      ? candidate.parent
      : undefined;
    const replaceNode = awaitNode ?? call;
    const declarator = candidate.declarator;
    const declaration = candidate.declaration;
    const exportNode = candidate.exportNode?.type === "ExportNamedDeclaration" &&
      candidate.exportNode.declaration === declaration ? candidate.exportNode : undefined;
    const direct = declarator && declaration?.kind === "const" && declaration.declarations.length === 1 &&
      (declarator.init === call || declarator.init === awaitNode);
    let name: string | undefined;
    let scopeName: string | undefined;
    if (direct && declarator.id.type === "Identifier") name = declarator.id.name;
    else if (direct && macroName === "createScoped" && declarator.id.type === "ArrayPattern" &&
      declarator.id.elements.length === 2 && declarator.id.elements.every((item) => item?.type === "Identifier")) {
      const [valueBinding, scopeBinding] = declarator.id.elements;
      if (valueBinding?.type === "Identifier" && scopeBinding?.type === "Identifier") {
        name = valueBinding.name;
        scopeName = scopeBinding.name;
      }
    }
    let options: ParsedDiOptions | undefined;
    let resources: Expression[] | undefined;
    if (macroName === "defineAppTeardown") {
      if (call.arguments.length !== 1 || call.arguments[0]?.type !== "ArrayExpression") {
        throw diagnostic(id, code, call, macroName, "expected exactly one array-literal argument");
      }
      const resourceNodes = call.arguments[0].elements.filter((item) => item !== null);
      if (resourceNodes.some((item) => item.type === "SpreadElement")) {
        throw diagnostic(id, code, call, macroName, "resource spreads are not supported");
      }
      resources = resourceNodes.filter((item): item is Expression => item.type !== "SpreadElement");
    } else {
      options = parseOptions(id, code, macroName, call);
    }
    const declarationNode = name ? (exportNode ?? declaration) : undefined;
    matches.push({
      macroName, localName, name, scopeName, options, resources, hasAwait: Boolean(awaitNode),
      typeArgs: call.typeArguments?.params ?? [], call, replaceNode,
      declaration: declarationNode, start: declarationNode?.start ?? replaceNode.start,
      end: declarationNode?.end ?? replaceNode.end, exported: Boolean(exportNode), scopeId: candidate.scopeId
    });
  }

  const bindings = new Map<MacroMatch, DiBindingRecord>();
  for (const match of matches) {
    if (!isDeclarationMacro(match)) continue;
    const kind = bindingKindFor(match);
    if (!kind) continue;
    const binding = { info: createBindingInfo(match.name, kind), match, scopeId: match.scopeId };
    bindings.set(match, binding);
    scopes[match.scopeId].bindings.set(match.name, binding);
  }
  const context = { code, id, program, matches, imports, scopes, bindings, sourceIdentifiers };
  validateDependencyGraph(context);
  return context;
}

function validateDependencyGraph(context: TransformContext): void {
  const nodes = new Map<DeclarationMacroMatch, DependencyGraphNode>();
  for (const [candidate, binding] of context.bindings) {
    if (!isDeclarationMacro(candidate) || !hasMacroOptions(candidate)) continue;
    const match = candidate;
    nodes.set(match, {
      match,
      binding,
      dependencies: match.options.deps
        .flatMap((dependency) => {
          if (dependency.type !== "Identifier") return [];
          const target = resolveBinding(context, match, dependency.name);
          return target ? [{ dependency: target.match.name, expression: dependency, target: target.match }] : [];
        }),
      eager: match.macroName === "createSingleton" ||
        (match.macroName === "defineSingleton" && !match.options.lazy),
      lazy: match.options.lazy,
      declarationStart: match.start
    });
  }

  const visiting = new Set<DeclarationMacroMatch>();
  const visited = new Set<DeclarationMacroMatch>();
  const path: DeclarationMacroMatch[] = [];
  const visit = (match: DeclarationMacroMatch): void => {
    if (visited.has(match)) return;
    const node = nodes.get(match);
    if (!node) return;
    visiting.add(match);
    path.push(match);
    for (const edge of node.dependencies) {
      if (!nodes.has(edge.target)) continue;
      if (visiting.has(edge.target)) {
        const cycleStart = path.indexOf(edge.target);
        const cycle = [...path.slice(cycleStart), edge.target].map((entry) => entry.name);
        throw diagnostic(context.id, context.code, edge.expression, node.match.macroName,
          `dependency cycle detected: ${cycle.join(" -> ")}`);
      }
      visit(edge.target);
    }
    path.pop();
    visiting.delete(match);
    visited.add(match);
  };
  for (const match of nodes.keys()) visit(match);

  for (const node of nodes.values()) {
    if (!node.eager) continue;
    for (const edge of node.dependencies) {
      const target = nodes.get(edge.target);
      if (target && target.binding.scopeId === node.binding.scopeId && target.declarationStart > node.declarationStart) {
        throw diagnostic(context.id, context.code, edge.expression, node.match.macroName,
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

export function resolveBinding(
  context: TransformContext,
  consumer: MacroMatch,
  name: string
): DiBindingRecord | undefined {
  let scope: LexicalScope | undefined = context.scopes[consumer.scopeId];
  while (scope) {
    if (scope.declaredNames.has(name)) return scope.bindings.get(name);
    scope = scope.parentId === undefined ? undefined : context.scopes[scope.parentId];
  }
  return undefined;
}

export function declarationBinding(
  context: TransformContext,
  match: DeclarationMacroMatch
): DiBindingRecord | undefined {
  return context.bindings.get(match);
}

export function resolveDependencyExpression(
  dependency: string,
  consumer: MacroMatch,
  context: TransformContext
): string {
  const binding = resolveBinding(context, consumer, dependency)?.info;
  if (!binding) return dependency;
  switch (binding.kind) {
    case "create-singleton": case "create-scoped": case "define-singleton": return binding.instanceName;
    case "define-singleton-lazy": return `${dependency}()`;
    case "create-transient": case "define-transient": case "define-scoped": return `${dependency}()`;
  }
}

export function resolveTeardownResource(
  resource: string,
  consumer: MacroMatch,
  context: TransformContext
): { expression: string; awaitExpression: boolean } {
  const binding = resolveBinding(context, consumer, resource)?.info;
  if (!binding) return { expression: resource, awaitExpression: false };
  switch (binding.kind) {
    case "create-singleton": case "create-scoped": case "define-singleton": return { expression: binding.instanceName, awaitExpression: false };
    case "define-singleton-lazy": return { expression: `${binding.peekName}()`, awaitExpression: false };
    case "create-transient": case "define-transient": case "define-scoped": return { expression: `${resource}()`, awaitExpression: false };
  }
}
