import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transformCompdiMacros } from "../src/transform";

function readFixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

function runFixture(name: string): string {
  const result = transformCompdiMacros(readFixture(name), name);

  if (!result) {
    throw new Error(`Expected transform to return code for fixture: ${name}`);
  }

  return result.code;
}

function snapshot(name: string): string {
  return `./__snapshots__/${name}.output.ts`;
}

describe("transformCompdiMacros", () => {
  describe("singleton", () => {
    describe("createSingleton", () => {
      it("instantiates a class target", async () => {
        await expect(runFixture("singleton/create-class.input.ts"))
          .toMatchFileSnapshot(snapshot("singleton/create-class"));
      });

      it("invokes a sync factory", async () => {
        await expect(runFixture("singleton/create-factory.input.ts"))
          .toMatchFileSnapshot(snapshot("singleton/create-factory"));
      });

      it("awaits an async factory when prefixed with await", async () => {
        await expect(runFixture("singleton/create-async.input.ts"))
          .toMatchFileSnapshot(snapshot("singleton/create-async"));
      });

      it("accepts lazy: true for createSingleton", () => {
        const input = [
          'import { createSingleton } from "@compdi/core";',
          "class Service {}",
          "const value = createSingleton({ target: Service, deps: [], lazy: true });"
        ].join("\n");

        const result = transformCompdiMacros(input, "create-singleton-lazy.input.ts");

        if (!result) {
          throw new Error("Expected createSingleton lazy transform to return code");
        }

        expect(result.code).toContain("const value = new Service();");
      });
    });

    describe("defineSingleton", () => {
      it("creates an eager getter for a class target", async () => {
        await expect(runFixture("singleton/define-eager-class.input.ts"))
          .toMatchFileSnapshot(snapshot("singleton/define-eager-class"));
      });

      it("creates an eager getter for a factory", async () => {
        await expect(runFixture("singleton/define-eager-factory.input.ts"))
          .toMatchFileSnapshot(snapshot("singleton/define-eager-factory"));
      });

      it("creates a lazy getter when lazy: true", async () => {
        await expect(runFixture("singleton/define-lazy.input.ts"))
          .toMatchFileSnapshot(snapshot("singleton/define-lazy"));
      });
    });
  });

  describe("transient", () => {
    describe("createTransient", () => {
      it("returns a factory function that creates a new instance each call", async () => {
        await expect(runFixture("transient/create.input.ts"))
          .toMatchFileSnapshot(snapshot("transient/create"));
      });

      it("creates distinct instances on each factory call at runtime", async () => {
        const input = [
          'import { createTransient } from "@compdi/core";',
          "class Handler {}",
          "export const createHandler = createTransient({ target: Handler, deps: [] });",
          "export const first = createHandler();",
          "export const second = createHandler();"
        ].join("\n");

        const result = transformCompdiMacros(input, "transient/runtime.input.js");

        if (!result) {
          throw new Error("Expected runtime transient fixture to be transformed");
        }

        const encoded = Buffer.from(result.code).toString("base64");
        const module = await import(`data:text/javascript;base64,${encoded}`);

        expect(typeof module.createHandler).toBe("function");
        expect(module.first).not.toBe(module.second);
      });
    });

    describe("defineTransient", () => {
      it("returns a factory function that creates a new instance each call", async () => {
        await expect(runFixture("transient/define.input.ts"))
          .toMatchFileSnapshot(snapshot("transient/define"));
      });
    });
  });

  describe("scoped", () => {
    describe("defineScoped", () => {
      it("returns a context-keyed accessor backed by a registry", async () => {
        const code = runFixture("scoped/define.input.ts");
        expect(code).not.toMatch(/\bdefineScoped\s*\(/);
        expect(code).not.toContain("@compdi/core");
        await expect(code)
          .toMatchFileSnapshot(snapshot("scoped/define"));
      });
    });

    describe("createScoped with a context resolver", () => {
      it("generates a contextual proxy without macro calls", async () => {
        const code = runFixture("scoped/create-contextual.input.ts");
        expect(code).not.toMatch(/\bcreateScoped\s*\(/);
        expect(code).toContain("const __createScoped_database = (__context:");
        expect(code).toContain("(createDatabase)(__context, connectionString)");
        await expect(code)
          .toMatchFileSnapshot(snapshot("scoped/create-contextual"));
      });
    });
  });

  describe("teardown", () => {
    describe("defineAppTeardown", () => {
      it("generates an async disposal function for registered resources", async () => {
        await expect(runFixture("teardown/basic.input.ts"))
          .toMatchFileSnapshot(snapshot("teardown/basic"));
      });
    });
  });

  it("transforms every macro without exporting private declarations", () => {
    const input = [
      'import { createSingleton, defineSingleton, createTransient, defineTransient, createScoped, defineScoped, defineAppTeardown } from "@compdi/core";',
      "class Service {}",
      "const context = {};",
      "const privateSingleton = createSingleton({ target: Service, deps: [] });",
      "const privateSingletonAccessor = defineSingleton({ target: Service, deps: [] });",
      "const privateTransient = createTransient({ target: Service, deps: [] });",
      "const privateTransientAlias = defineTransient({ target: Service, deps: [] });",
      "const privateScopedAccessor = defineScoped({ target: Service, deps: [] });",
      "const [privateScoped, privateScope] = createScoped({ target: Service, deps: [], context: () => context });",
      "const privateTeardown = defineAppTeardown([]);",
      "export const publicService = createSingleton({ target: Service, deps: [privateSingleton] });"
    ].join("\n");

    const result = transformCompdiMacros(input, "private-macros.input.ts");
    if (!result) throw new Error("Expected private macros to be transformed");

    expect(result.code).not.toMatch(/\b(?:create|define)(?:Singleton|Transient|Scoped|AppTeardown)\s*\(/);
    for (const name of [
      "privateSingleton",
      "privateSingletonAccessor",
      "privateTransient",
      "privateTransientAlias",
      "privateScopedAccessor",
      "privateTeardown"
    ]) {
      expect(result.code).toMatch(new RegExp(`^const ${name}\\b`, "m"));
      expect(result.code).not.toMatch(new RegExp(`^export const ${name}\\b`, "m"));
    }
    expect(result.code).toMatch(/^const \[privateScoped, privateScope\]/m);
    expect(result.code).toMatch(/^export const publicService\b/m);
  });

  it("generates a source map for transformed files", () => {
    const result = transformCompdiMacros(
      readFixture("singleton/define-lazy.input.ts"),
      "singleton/define-lazy.input.ts"
    );

    if (!result) {
      throw new Error("Expected transform to return code and map");
    }

    expect(result.map).toBeTruthy();
    expect(result.map?.toString()).toContain("singleton/define-lazy.input.ts");
  });

  it("supports boundary and disabled source maps", () => {
    const input = readFixture("singleton/create-class.input.ts");
    const boundary = transformCompdiMacros(input, "boundary.input.ts", "boundary");
    const disabled = transformCompdiMacros(input, "disabled.input.ts", false);

    expect(boundary?.map?.toString()).toContain("boundary.input.ts");
    expect(disabled?.map).toBeNull();
  });

  describe("AST discovery", () => {
    it("skips parsing Compdi imports that contain no macro names", () => {
      const input = [
        'import { type SingletonOptions } from "@compdi/core";',
        "const invalidSyntax = ;"
      ].join("\n");

      expect(transformCompdiMacros(input, "runtime-only.input.ts")).toBeNull();
    });

    it("matches imported aliases, static property forms, and preserves non-macro imports", () => {
      const input = [
        'import { createSingleton as singleton, macroNotTransformed } from "@compdi/core";',
        "class Service {}",
        "const target = Service;",
        "export const service: Service = singleton({ \"deps\": [], target });",
        "export { macroNotTransformed };"
      ].join("\n");
      const result = transformCompdiMacros(input, "alias.input.ts");
      expect(result?.code).toContain('import { macroNotTransformed } from "@compdi/core";');
      expect(result?.code).toContain("export const service = new target();");
      expect(result?.code).not.toContain("createSingleton as singleton");
    });

    it("does not transform a lexically shadowed imported alias", () => {
      const input = [
        'import { createSingleton as singleton } from "@compdi/core";',
        "function local(singleton: Function) { return singleton({ target: Date, deps: [] }); }",
        "export const service = singleton({ target: Date, deps: [] });"
      ].join("\n");
      const result = transformCompdiMacros(input, "shadow.input.ts");
      expect(result?.code).toContain("return singleton({ target: Date, deps: [] })");
      expect(result?.code).toContain("export const service = new Date();");
    });

    it("does not transform aliases shadowed by catch or loop bindings", () => {
      const input = [
        'import { createSingleton as singleton } from "@compdi/core";',
        "try { throw null; } catch (singleton) { singleton({ target: Date, deps: [] }); }",
        "for (const singleton of []) { singleton({ target: Date, deps: [] }); }",
        "export const service = singleton({ target: Date, deps: [] });"
      ].join("\n");
      const result = transformCompdiMacros(input, "catch-loop-shadow.input.ts");

      expect(result?.code.match(/singleton\(\{ target: Date, deps: \[\] \}\)/g)).toHaveLength(2);
      expect(result?.code).toContain("export const service = new Date();");
    });

    it("keeps declarations inside exported functions local", () => {
      const input = [
        'import { createSingleton } from "@compdi/core";',
        "export function make() {",
        "  const value = createSingleton({ target: Date, deps: [] });",
        "  return value;",
        "}"
      ].join("\n");
      const result = transformCompdiMacros(input, "exported-function.input.ts");
      expect(result?.code).toContain("export function make() {");
      expect(result?.code).toContain("  const value = new Date();");
      expect(result?.code).not.toContain("export const value");
    });

    it("lowers nested macro expressions without overlapping replacements", () => {
      const input = [
        'import { createSingleton, defineSingleton, createTransient, defineTransient, defineScoped, createScoped, defineAppTeardown } from "@compdi/core";',
        "class Service {}",
        "const getContext = () => 'ctx';",
        "export const values = [",
        "  createSingleton({ target: Service, deps: [createSingleton({ target: Date, deps: [] })] }),",
        "  defineSingleton({ target: Service, deps: [] }),",
        "  createTransient({ target: Service, deps: [] }),",
        "  defineTransient({ target: Service, deps: [] }),",
        "  defineScoped({ target: Service, deps: [] }),",
        "  createScoped({ target: Service, deps: [], context: getContext }),",
        "  defineAppTeardown([])",
        "];"
      ].join("\n");
      const result = transformCompdiMacros(input, "nested.input.ts");
      expect(result?.code).not.toMatch(/\b(?:create|define)(?:Singleton|Transient|Scoped|AppTeardown)\s*\(/);
      expect(result?.code).toContain("new Service(new Date())");
      expect(result?.code).toContain("(() => {");
    });

    it("reports unsupported recognized options with a source location", () => {
      const input = [
        'import { createSingleton } from "@compdi/core";',
        "const options = { target: Date, deps: [] };",
        "const value = createSingleton({ ...options });"
      ].join("\n");
      expect(() => transformCompdiMacros(input, "invalid-options.input.ts"))
        .toThrow(/\[compdi\] createSingleton at invalid-options\.input\.ts:\d+:\d+: object spreads are not supported/);
    });

    it("surfaces syntax-invalid input as a build diagnostic", () => {
      expect(() => transformCompdiMacros('import { createSingleton } from "@compdi/core"; const = ;', "invalid.input.ts"))
        .toThrow(/\[compdi\] Failed to parse invalid\.input\.ts: Unexpected token/);
    });
  });

  describe("strict diagnostics", () => {
    const transformInvalid = (macro: string, options: string): void => {
      transformCompdiMacros(
        `import { ${macro} } from "@compdi/core";\nconst value = ${macro}(${options});`,
        "diagnostic.input.ts"
      );
    };

    it.each([
      ["createSingleton", "{ target: Date, factory: () => new Date() }", "exactly one"],
      ["createSingleton", "{ target: Date, unknown: true }", "unknown option `unknown`"],
      ["defineSingleton", "{ target: Date, lazy: flag }", "boolean literal"],
      ["createTransient", "{ target: Date, lazy: true }", "only by singleton macros"],
      ["defineScoped", "{ target: Date, context: () => ({}) }", "only by `createScoped`"],
      ["createScoped", "{ target: Date }", "`context` is required"],
      ["createSingleton", "{ target: Date, onRelease: () => {} }", "only by scoped macros"],
      ["createSingleton", "{ target: Date, deps: [,] }", "array holes"]
    ])("rejects invalid %s options", (macro, options, message) => {
      expect(() => transformInvalid(macro, options)).toThrowError(
        expect.objectContaining({ message: expect.stringContaining(message) })
      );
    });

    it("includes macro and source location in diagnostics", () => {
      expect(() => transformInvalid("createScoped", "{ target: Date }")).toThrow(
        /\[compdi\] createScoped at diagnostic\.input\.ts:2:\d+:/
      );
    });
  });

  describe("dependency graph diagnostics", () => {
    const transformGraph = (lines: string[]): ReturnType<typeof transformCompdiMacros> =>
      transformCompdiMacros([
        'import { createSingleton, defineSingleton, defineTransient } from "@compdi/core";',
        "class Service {}",
        ...lines
      ].join("\n"), "graph.input.ts");

    it("rejects a direct dependency cycle with its source and path", () => {
      expect(() => transformGraph([
        "const service = defineTransient({ target: Service, deps: [service] });"
      ])).toThrow(/\[compdi\] defineTransient at graph\.input\.ts:3:\d+: dependency cycle detected: service -> service/);
    });

    it("rejects multi-node transient and lazy cycles", () => {
      expect(() => transformGraph([
        "const first = defineTransient({ target: Service, deps: [second] });",
        "const second = defineTransient({ target: Service, deps: [third] });",
        "const third = defineTransient({ target: Service, deps: [first] });"
      ])).toThrow(/first -> second -> third -> first/);

      expect(() => transformGraph([
        "const first = defineSingleton({ target: Service, deps: [second], lazy: true });",
        "const second = defineSingleton({ target: Service, deps: [first], lazy: true });"
      ])).toThrow(/first -> second -> first/);
    });

    it("rejects eager references to later local DI declarations", () => {
      expect(() => transformGraph([
        "const first = createSingleton({ target: Service, deps: [second] });",
        "const second = createSingleton({ target: Service, deps: [] });"
      ])).toThrow(/eager dependency `second` is declared after `first`/);
    });

    it("accepts backward references, opaque expressions, and imported dependencies", () => {
      const result = transformCompdiMacros([
        'import { external } from "./external";',
        'import { createSingleton } from "@compdi/core";',
        "class Service {}",
        "const first = createSingleton({ target: Service, deps: [] });",
        "const second = createSingleton({ target: Service, deps: [first] });",
        "const third = createSingleton({ target: Service, deps: [external, () => later] });",
        "const later = 1;"
      ].join("\n"), "valid-graph.input.ts");

      expect(result?.code).toContain("const second = new Service(first);");
      expect(result?.code).toContain("new Service(external, () => later)");
    });
  });

  describe("lexical dependency resolution", () => {
    const imports = 'import { createSingleton, defineSingleton, defineTransient, defineAppTeardown } from "@compdi/core";';

    it("keeps function-local bindings from replacing module bindings with the same name", () => {
      const result = transformCompdiMacros([
        imports,
        "class Service {}",
        "const service = defineTransient({ target: Service, deps: [] });",
        "function make() {",
        "  const service = defineSingleton({ target: Service, deps: [] });",
        "  return service;",
        "}",
        "export const consumer = createSingleton({ target: Service, deps: [service] });"
      ].join("\n"), "scope-collision.input.ts");

      expect(result?.code).toContain("export const consumer = new Service(service());");
      expect(result?.code).not.toContain("export const consumer = new Service(__service);");
    });

    it("resolves nested and sibling scopes independently", () => {
      const result = transformCompdiMacros([
        imports,
        "class Service {}",
        "function first() {",
        "  const shared = defineSingleton({ target: Service, deps: [] });",
        "  { const consumer = createSingleton({ target: Service, deps: [shared] }); return consumer; }",
        "}",
        "function second() {",
        "  const shared = defineTransient({ target: Service, deps: [] });",
        "  const consumer = createSingleton({ target: Service, deps: [shared] });",
        "  return consumer;",
        "}"
      ].join("\n"), "nested-scopes.input.ts");

      expect(result?.code).toContain("new Service(__shared)");
      expect(result?.code).toContain("new Service(shared())");
    });

    it("stops at parameters, variables, destructuring, catch bindings, and loop bindings", () => {
      const result = transformCompdiMacros([
        imports,
        "class Service {}",
        "const dependency = defineTransient({ target: Service, deps: [] });",
        "function parameter(dependency: unknown) { return createSingleton({ target: Service, deps: [dependency] }); }",
        "function variable() { const dependency = {}; return createSingleton({ target: Service, deps: [dependency] }); }",
        "function destructured(source: { dependency: unknown }) { const { dependency } = source; return createSingleton({ target: Service, deps: [dependency] }); }",
        "try { throw null; } catch (dependency) { createSingleton({ target: Service, deps: [dependency] }); }",
        "for (const dependency of []) { createSingleton({ target: Service, deps: [dependency] }); }"
      ].join("\n"), "ordinary-shadowing.input.ts");

      expect(result?.code.match(/new Service\(dependency\)/g)).toHaveLength(5);
      expect(result?.code).not.toContain("new Service(dependency())");
    });

    it("honors function-scoped var hoisting when resolving dependencies", () => {
      const result = transformCompdiMacros([
        imports,
        "class Service {}",
        "const dependency = defineTransient({ target: Service, deps: [] });",
        "function make() {",
        "  const consumer = createSingleton({ target: Service, deps: [dependency] });",
        "  var dependency = {};",
        "  return consumer;",
        "}"
      ].join("\n"), "var-shadowing.input.ts");

      expect(result?.code).toContain("const consumer = new Service(dependency);");
      expect(result?.code).not.toContain("const consumer = new Service(dependency());");
    });

    it("uses AST var bindings for simple, multiple, and destructured declarations", () => {
      const result = transformCompdiMacros([
        imports,
        "class Service {}",
        "const simple = defineTransient({ target: Service, deps: [] });",
        "const multiple = defineTransient({ target: Service, deps: [] });",
        "const objectDependency = defineTransient({ target: Service, deps: [] });",
        "const arrayDependency = defineTransient({ target: Service, deps: [] });",
        "function make() {",
        "  createSingleton({ target: Service, deps: [simple] });",
        "  createSingleton({ target: Service, deps: [multiple] });",
        "  createSingleton({ target: Service, deps: [objectDependency] });",
        "  createSingleton({ target: Service, deps: [arrayDependency] });",
        "  var simple;",
        "  var multiple, other;",
        "  var { objectDependency } = {};",
        "  var [arrayDependency] = [];",
        "}"
      ].join("\n"), "var-patterns.input.ts");

      for (const dependency of ["simple", "multiple", "objectDependency", "arrayDependency"]) {
        expect(result?.code).toContain(`new Service(${dependency})`);
        expect(result?.code).not.toContain(`new Service(${dependency}())`);
      }
    });

    it("defers macro validation when a later var shadows the imported alias", () => {
      const input = [
        'import { createSingleton as macro } from "@compdi/core";',
        "function local() {",
        "  macro({ unknown: true });",
        "  var macro = () => null;",
        "}"
      ].join("\n");

      expect(() => transformCompdiMacros(input, "var-alias-shadow.input.ts")).not.toThrow();
      expect(transformCompdiMacros(input, "var-alias-shadow.input.ts")).toBeNull();
    });

    it("keeps body var declarations out of default parameter scope", () => {
      const input = [
        'import { createSingleton as macro } from "@compdi/core";',
        "function make(value = macro({ target: Date, deps: [] })) {",
        "  var macro = () => null;",
        "  return value;",
        "}"
      ].join("\n");
      const result = transformCompdiMacros(input, "parameter-scope.input.ts");

      expect(result?.code).toContain("function make(value = new Date())");
    });

    it("treats named class expressions as lexical bindings", () => {
      const result = transformCompdiMacros([
        imports,
        "class Service {}",
        "const Dependency = defineTransient({ target: Service, deps: [] });",
        "const Holder = class Dependency {",
        "  static value = createSingleton({ target: Service, deps: [Dependency] });",
        "};"
      ].join("\n"), "class-scope.input.ts");

      expect(result?.code).toContain("static value = new Service(Dependency)");
      expect(result?.code).not.toContain("static value = new Service(Dependency())");
    });

    it("ignores var text in comments, strings, and larger identifiers", () => {
      const result = transformCompdiMacros([
        imports,
        "class Service {}",
        "// var dependency = somethingElse;",
        'const text = "var dependency";',
        "const variable = text;",
        "const dependency = defineTransient({ target: Service, deps: [] });",
        "const consumer = createSingleton({ target: Service, deps: [dependency] });",
        "void variable;"
      ].join("\n"), "var-text.input.ts");

      expect(result?.code).toContain("const consumer = new Service(dependency());");
    });

    it("detects cycles inside functions and blocks without crossing sibling scopes", () => {
      expect(() => transformCompdiMacros([
        imports,
        "class Service {}",
        "function make() {",
        "  const first = defineTransient({ target: Service, deps: [second] });",
        "  const second = defineTransient({ target: Service, deps: [first] });",
        "}"
      ].join("\n"), "function-cycle.input.ts")).toThrow(/first -> second -> first/);

      expect(() => transformCompdiMacros([
        imports,
        "class Service {}",
        "{",
        "  const first = defineTransient({ target: Service, deps: [second] });",
        "  const second = defineTransient({ target: Service, deps: [first] });",
        "}"
      ].join("\n"), "block-cycle.input.ts")).toThrow(/first -> second -> first/);

      expect(() => transformCompdiMacros([
        imports,
        "class Service {}",
        "function first() { const service = defineTransient({ target: Service, deps: [] }); return service; }",
        "function second() { const service = defineTransient({ target: Service, deps: [] }); return service; }"
      ].join("\n"), "sibling-bindings.input.ts")).not.toThrow();
    });

    it("rejects same-scope eager forward references but permits outer references", () => {
      expect(() => transformCompdiMacros([
        imports,
        "class Service {}",
        "function make() {",
        "  const consumer = createSingleton({ target: Service, deps: [dependency] });",
        "  const dependency = createSingleton({ target: Service, deps: [] });",
        "}"
      ].join("\n"), "local-forward.input.ts")).toThrow(/eager dependency `dependency` is declared after `consumer`/);

      expect(() => transformCompdiMacros([
        imports,
        "class Service {}",
        "function make() { return createSingleton({ target: Service, deps: [dependency] }); }",
        "const dependency = createSingleton({ target: Service, deps: [] });"
      ].join("\n"), "outer-forward.input.ts")).not.toThrow();
    });

    it("resolves teardown resources from the teardown declaration scope", () => {
      const result = transformCompdiMacros([
        imports,
        "class Service {}",
        "const resource = defineSingleton({ target: Service, deps: [] });",
        "const stop = defineAppTeardown([resource]);",
        "function local() {",
        "  const resource = defineTransient({ target: Service, deps: [] });",
        "  const stop = defineAppTeardown([resource]);",
        "  return stop;",
        "}"
      ].join("\n"), "teardown-scopes.input.ts");

      expect(result?.code).toContain("const __resource_0 = __resource;");
      expect(result?.code).toContain("const __resource_0 = resource();");
    });
  });
});
