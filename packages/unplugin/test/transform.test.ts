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
        await expect(runFixture("scoped/define.input.ts"))
          .toMatchFileSnapshot(snapshot("scoped/define"));
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
