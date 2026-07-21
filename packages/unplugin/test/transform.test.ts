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
    expect(result.map.toString()).toContain("singleton/define-lazy.input.ts");
  });
});
