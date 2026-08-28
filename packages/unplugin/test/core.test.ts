import { describe, expect, it } from "vitest";
import { compdiFactory } from "../src/core";

const input = [
  'import { createSingleton } from "@compdi/core";',
  "class Service {}",
  "export const service = createSingleton({ target: Service, deps: [] });"
].join("\n");

async function runWithInclude(include: RegExp, id: string): Promise<unknown> {
  const plugin = compdiFactory({ include }, { framework: "vite", versions: {} });
  const hook = plugin.transform;
  if (!hook) throw new Error("Expected Compdi transform hook");
  if (typeof hook === "function") return hook.call({} as never, input, id);
  return hook.handler.call({} as never, input, id);
}

describe("Compdi plugin options", () => {
  it.each([/\.ts$/g, /.+\.ts$/y])("resets stateful include regexes for %s", async (include) => {
    expect(await runWithInclude(include, "first.ts")).toBeTruthy();
    expect(await runWithInclude(include, "second.ts")).toBeTruthy();
    expect(include.lastIndex).toBe(0);
  });

  it("passes the source-map mode to the compiler transform", async () => {
    const plugin = compdiFactory({ sourcemap: false }, { framework: "vite", versions: {} });
    const hook = plugin.transform;
    if (!hook) throw new Error("Expected Compdi transform hook");
    const result = typeof hook === "function"
      ? await hook.call({} as never, input, "source-map.ts")
      : await hook.handler.call({} as never, input, "source-map.ts");

    expect(result).toMatchObject({ map: null });
  });
});
