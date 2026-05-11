import MagicString from "magic-string";
import { parseSync } from "oxc-parser";
import {
  findMatchingParen,
  splitDependencyList,
  splitTopLevelArgs
} from "@compdi/shared";

type Replacement = {
  start: number;
  end: number;
  code: string;
};

type BindingKind =
  | "create-singleton"
  | "define-singleton"
  | "create-lazy-singleton"
  | "define-lazy-singleton"
  | "create-async-singleton"
  | "define-async-singleton";

type BindingInfo = {
  kind: BindingKind;
  instanceName: string;
  getterName?: string;
  peekName?: string;
  promiseName?: string;
};

const CORE_IMPORT_REGEX = /import\s*{[^}]*}\s*from\s*["'](?:@compdi\/core|compdi)["'];?\s*/g;
const CREATE_SINGLETON_REGEX =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*createSingleton\(\s*([\s\S]*?),\s*\[([\s\S]*?)\]\s*\)\s*;?/g;
const DEFINE_SINGLETON_REGEX =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*defineSingleton\(\s*([\s\S]*?),\s*\[([\s\S]*?)\]\s*\)\s*;?/g;
const TRANSIENT_REGEX =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*defineTransient\(\s*([\s\S]*?),\s*\[([\s\S]*?)\]\s*\)\s*;?/g;
const CREATE_LAZY_REGEX =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*createLazySingleton\(\s*([\s\S]*?),\s*\[([\s\S]*?)\]\s*\)\s*;?/g;
const DEFINE_LAZY_REGEX =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*defineLazySingleton\(\s*([\s\S]*?),\s*\[([\s\S]*?)\]\s*\)\s*;?/g;
const TEARDOWN_REGEX =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*defineAppTeardown\(\s*\[([\s\S]*?)\]\s*\)\s*;?/g;

function parseWithOxc(code: string, id: string): boolean {
  try {
    parseSync(id, code, { showSemanticErrors: false });
    return true;
  } catch {
    return false;
  }
}

function createBindingInfo(name: string, kind: BindingKind): BindingInfo {
  switch (kind) {
    case "create-singleton":
    case "define-singleton":
    case "create-async-singleton":
      return {
        kind,
        instanceName: `__${name}`
      };
    case "create-lazy-singleton":
    case "define-lazy-singleton":
      return {
        kind,
        instanceName: `__lazy_${name}`,
        getterName: `__get_${name}`,
        peekName: `__peek_${name}`
      };
    case "define-async-singleton":
      return {
        kind,
        instanceName: `__value_${name}`,
        getterName: `__get_${name}`,
        peekName: `__peek_${name}`,
        promiseName: `__promise_${name}`
      };
  }
}

function collectBindings(code: string): Map<string, BindingInfo> {
  const bindings = new Map<string, BindingInfo>();

  const register = (regex: RegExp, kind: BindingKind): void => {
    for (const match of code.matchAll(regex)) {
      bindings.set(match[1], createBindingInfo(match[1], kind));
    }
  };

  register(CREATE_SINGLETON_REGEX, "create-singleton");
  register(DEFINE_SINGLETON_REGEX, "define-singleton");
  register(CREATE_LAZY_REGEX, "create-lazy-singleton");
  register(DEFINE_LAZY_REGEX, "define-lazy-singleton");

  const createAsyncHeadRegex =
    /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*createAsyncSingleton\s*\(/g;
  for (const match of code.matchAll(createAsyncHeadRegex)) {
    bindings.set(match[1], createBindingInfo(match[1], "create-async-singleton"));
  }

  const defineAsyncHeadRegex =
    /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*defineAsyncSingleton\s*\(/g;
  for (const match of code.matchAll(defineAsyncHeadRegex)) {
    bindings.set(match[1], createBindingInfo(match[1], "define-async-singleton"));
  }

  return bindings;
}

function resolveDependencyExpression(
  dependency: string,
  bindings: ReadonlyMap<string, BindingInfo>,
  mode: "sync" | "async"
): string {
  const binding = bindings.get(dependency);
  if (!binding) {
    return dependency;
  }

  switch (binding.kind) {
    case "create-singleton":
    case "define-singleton":
    case "create-async-singleton":
      return binding.instanceName;
    case "create-lazy-singleton":
    case "define-lazy-singleton":
      return `${binding.getterName}()`;
    case "define-async-singleton":
      return mode === "async" ? `await ${binding.getterName}()` : dependency;
  }
}

function resolveDependencies(
  rawDependencies: string,
  bindings: ReadonlyMap<string, BindingInfo>,
  mode: "sync" | "async"
): string {
  const deps = splitDependencyList(rawDependencies).map((dependency) =>
    resolveDependencyExpression(dependency, bindings, mode)
  );

  return deps.join(", ");
}

function resolveTeardownResource(
  resource: string,
  bindings: ReadonlyMap<string, BindingInfo>
): { expression: string; awaitExpression: boolean } {
  const binding = bindings.get(resource);
  if (!binding) {
    return { expression: resource, awaitExpression: false };
  }

  switch (binding.kind) {
    case "create-singleton":
    case "define-singleton":
    case "create-async-singleton":
      return {
        expression: binding.instanceName,
        awaitExpression: false
      };
    case "create-lazy-singleton":
    case "define-lazy-singleton":
      return {
        expression: `${binding.peekName}()`,
        awaitExpression: false
      };
    case "define-async-singleton":
      return {
        expression: `${binding.peekName}()`,
        awaitExpression: true
      };
  }
}

function collectAsyncSingletonReplacements(
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
          ? `const ${binding.instanceName} = await (${factory})(${invokeArgs});\nexport const ${name} = ${binding.instanceName};`
          : [
              `let ${binding.promiseName} = null;`,
              `const ${binding.getterName} = () => {`,
              `  if (!${binding.promiseName}) ${binding.promiseName} = Promise.resolve((${factory})(${invokeArgs}));`,
              `  return ${binding.promiseName};`,
              `};`,
              `const ${binding.peekName} = () => ${binding.promiseName};`,
              `export const ${name} = ${binding.getterName};`
            ].join("\n")
    });

    headRegex.lastIndex = endIndex;
    headMatch = headRegex.exec(code);
  }

  return replacements;
}

function applyReplacements(code: string, replacements: Replacement[]): string {
  if (replacements.length === 0) {
    return code;
  }

  const ms = new MagicString(code);
  const sorted = [...replacements].sort((left, right) => right.start - left.start);

  for (const replacement of sorted) {
    ms.overwrite(replacement.start, replacement.end, replacement.code);
  }

  ms.prepend("// Generated by Compdi\n");
  return ms.toString();
}

export function transformCompdiMacros(code: string, id: string): string | null {
  if (!/\.[cm]?[jt]sx?$/.test(id)) {
    return null;
  }

  if (!code.includes("@compdi/core") && !code.includes('"compdi"') && !code.includes("'compdi'")) {
    return null;
  }

  if (!parseWithOxc(code, id)) {
    return null;
  }

  const bindings = collectBindings(code);
  const replacements: Replacement[] = [];

  for (const match of code.matchAll(CORE_IMPORT_REGEX)) {
    replacements.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      code: ""
    });
  }

  for (const match of code.matchAll(CREATE_SINGLETON_REGEX)) {
    const name = match[1];
    const target = match[2].trim();
    const deps = resolveDependencies(match[3], bindings, "sync");
    const binding = bindings.get(name);
    if (!binding) {
      continue;
    }

    replacements.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      code: `const ${binding.instanceName} = new ${target}(${deps});\nexport const ${name} = ${binding.instanceName};`
    });
  }

  for (const match of code.matchAll(DEFINE_SINGLETON_REGEX)) {
    const name = match[1];
    const target = match[2].trim();
    const deps = resolveDependencies(match[3], bindings, "sync");
    const binding = bindings.get(name);
    if (!binding) {
      continue;
    }

    replacements.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      code: `const ${binding.instanceName} = new ${target}(${deps});\nexport const ${name} = () => ${binding.instanceName};`
    });
  }

  for (const match of code.matchAll(TRANSIENT_REGEX)) {
    const name = match[1];
    const target = match[2].trim();
    const deps = resolveDependencies(match[3], bindings, "sync");
    replacements.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      code: `export const ${name} = () => new ${target}(${deps});`
    });
  }

  for (const match of code.matchAll(CREATE_LAZY_REGEX)) {
    const name = match[1];
    const target = match[2].trim();
    const deps = resolveDependencies(match[3], bindings, "sync");
    const binding = bindings.get(name);
    if (!binding) {
      continue;
    }

    replacements.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      code: [
        `let ${binding.instanceName} = null;`,
        `const ${binding.getterName} = () => {`,
        `  if (!${binding.instanceName}) ${binding.instanceName} = new ${target}(${deps});`,
        `  return ${binding.instanceName};`,
        `};`,
        `const ${binding.peekName} = () => ${binding.instanceName};`,
        `export const ${name} = new Proxy({}, {`,
        `  get: (_, prop) => {`,
        `    return Reflect.get(${binding.getterName}(), prop);`,
        `  }`,
        `});`
      ].join("\n")
    });
  }

  for (const match of code.matchAll(DEFINE_LAZY_REGEX)) {
    const name = match[1];
    const target = match[2].trim();
    const deps = resolveDependencies(match[3], bindings, "sync");
    const binding = bindings.get(name);
    if (!binding) {
      continue;
    }

    replacements.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      code: [
        `let ${binding.instanceName} = null;`,
        `const ${binding.getterName} = () => {`,
        `  if (!${binding.instanceName}) ${binding.instanceName} = new ${target}(${deps});`,
        `  return ${binding.instanceName};`,
        `};`,
        `const ${binding.peekName} = () => ${binding.instanceName};`,
        `export const ${name} = ${binding.getterName};`
      ].join("\n")
    });
  }

  for (const match of code.matchAll(TEARDOWN_REGEX)) {
    const name = match[1];
    const resources = splitDependencyList(match[2]);

    const lines = resources.flatMap((resource, index) => {
      const resolved = resolveTeardownResource(resource, bindings);
      const localName = `__resource_${index}`;

      return [
        `  const ${localName} = ${resolved.awaitExpression ? `await ${resolved.expression}` : resolved.expression};`,
        `  if (${localName}?.[Symbol.asyncDispose]) tasks.push(${localName}[Symbol.asyncDispose]());`,
        `  else if (${localName}?.[Symbol.dispose]) {`,
        `    try {`,
        `      ${localName}[Symbol.dispose]();`,
        `    } catch (error) {`,
        `      tasks.push(Promise.reject(error));`,
        `    }`,
        `  }`
      ];
    });

    replacements.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      code: [
        `export const ${name} = async () => {`,
        `  const tasks = [];`,
        ...lines,
        `  await Promise.allSettled(tasks);`,
        `};`
      ].join("\n")
    });
  }

  replacements.push(...collectAsyncSingletonReplacements(code, bindings, "create"));
  replacements.push(...collectAsyncSingletonReplacements(code, bindings, "define"));

  if (replacements.length === 0) {
    return null;
  }

  return applyReplacements(code, replacements);
}
