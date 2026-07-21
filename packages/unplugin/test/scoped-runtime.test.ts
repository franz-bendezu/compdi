import { defineScoped } from "@compdi/core";
import { describe, expect, it } from "vitest";

interface Resource {
  id: number;
}

type Context = object;

let factoryCalls = 0;

export const useResource = defineScoped<Resource, Context>({
  factory: () => ({ id: ++factoryCalls }),
  deps: []
});

export const useAsyncResource = defineScoped<{ connected: boolean }, Context>({
  factory: async () => ({ connected: true }),
  deps: []
});

describe("defineScoped runtime lifecycle", () => {
  it("reuses, inspects, releases, and recreates scoped values", () => {
    const firstContext = {};
    const secondContext = {};

    expect(useResource.peek(firstContext)).toBeUndefined();
    expect(useResource.has(firstContext)).toBe(false);
    expect(useResource.release(firstContext)).toBeUndefined();
    expect(factoryCalls).toBe(0);

    const first = useResource(firstContext);
    expect(useResource(firstContext)).toBe(first);
    expect(useResource(secondContext)).not.toBe(first);
    expect(useResource.has(firstContext)).toBe(true);
    expect(useResource.peek(firstContext)).toBe(first);
    expect(useResource.release(firstContext)).toBe(first);
    expect(useResource.peek(firstContext)).toBeUndefined();
    expect(useResource(firstContext)).not.toBe(first);
  });

  it("preserves async factory promise values", async () => {
    const context = {};
    const value = useAsyncResource(context);

    expect(value).toBeInstanceOf(Promise);
    expect(useAsyncResource.peek(context)).toBe(value);
    await expect(value).resolves.toEqual({ connected: true });
    expect(useAsyncResource.release(context)).toBe(value);
  });
});
