import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transformCompdiMacros } from "../src/transform";

function readFixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

function runFixture(name: string): string {
  const result = transformCompdiMacros(readFixture(name), name);

  if (!result) {
    throw new Error("Expected transform to return code");
  }

  return result.code;
}

describe("transformCompdiMacros", () => {
  it("rewrites singleton and transient macros", () => {
    const output = runFixture("singleton-transient.input.ts");

    expect(output).toMatchSnapshot();
  });

  it("rewrites lazy and async singleton macros", () => {
    const output = runFixture("lazy-async.input.ts");

    expect(output).toMatchSnapshot();
  });

  it("rewrites teardown macros with awaited async resources", () => {
    const output = runFixture("teardown.input.ts");

    expect(output).toMatchSnapshot();
  });

  it("returns a source map for transformed files", () => {
    const result = transformCompdiMacros(readFixture("lazy-async.input.ts"), "lazy-async.input.ts");

    if (!result) {
      throw new Error("Expected transform to return code and map");
    }

    expect(result.map).toBeTruthy();
    expect(result.map.toString()).toContain("lazy-async.input.ts");
  });
});