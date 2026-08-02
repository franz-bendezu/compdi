import { defineScoped } from "@compdi/core";
import { describe, expect, it } from "vitest";

interface Resource {
  id: number;
}

type Context = object;

let factoryCalls = 0;
const syncReleases: Resource[] = [];
const asyncReleases: Resource[] = [];

export const useResource = defineScoped<Resource, Context>({
  factory: () => ({ id: ++factoryCalls }),
  deps: []
});

export const useAsyncResource = defineScoped<{ connected: boolean }, Context>({
  factory: async () => ({ connected: true }),
  deps: []
});

export const useSyncCleanup = defineScoped({
  factory: () => ({ id: ++factoryCalls }),
  deps: [],
  onRelease: (instance, _context: Context) => {
    syncReleases.push(instance);
  }
});

export const useAsyncCleanup = defineScoped({
  factory: () => ({ id: ++factoryCalls }),
  deps: [],
  onRelease: async (instance, _context: Context) => {
    await Promise.resolve();
    asyncReleases.push(instance);
  }
});

let falseFactoryCalls = 0;
export const useFalseResource = defineScoped({ factory: () => { falseFactoryCalls++; return false; } });
let zeroFactoryCalls = 0;
export const useZeroResource = defineScoped({ factory: () => { zeroFactoryCalls++; return 0; } });
let emptyFactoryCalls = 0;
export const useEmptyResource = defineScoped({ factory: () => { emptyFactoryCalls++; return ""; } });
let nullFactoryCalls = 0;
export const useNullResource = defineScoped({ factory: () => { nullFactoryCalls++; return null; } });
let undefinedFactoryCalls = 0;
export const useUndefinedResource = defineScoped({ factory: () => { undefinedFactoryCalls++; return undefined; } });
let nanFactoryCalls = 0;
export const useNanResource = defineScoped({ factory: () => { nanFactoryCalls++; return Number.NaN; } });

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

  it("types release from synchronous and asynchronous cleanup", async () => {
    const syncContext = {};
    const syncValue = useSyncCleanup(syncContext);
    const syncReleased = useSyncCleanup.release(syncContext);
    expect(syncReleased).toBe(syncValue);
    expect(syncReleases).toEqual([syncValue]);

    const asyncContext = {};
    const asyncValue = useAsyncCleanup(asyncContext);
    const asyncReleased = useAsyncCleanup.release(asyncContext);
    expect(asyncReleased).toBeInstanceOf(Promise);
    await expect(asyncReleased).resolves.toBe(asyncValue);
    expect(asyncReleases).toEqual([asyncValue]);
  });

  it("caches all falsy scoped values", () => {
    const cases = [
      [useFalseResource, false, () => falseFactoryCalls],
      [useZeroResource, 0, () => zeroFactoryCalls],
      [useEmptyResource, "", () => emptyFactoryCalls],
      [useNullResource, null, () => nullFactoryCalls],
      [useUndefinedResource, undefined, () => undefinedFactoryCalls],
      [useNanResource, Number.NaN, () => nanFactoryCalls]
    ] as const;

    for (const [accessor, value, calls] of cases) {
      const context = {};
      expect(accessor(context)).toBe(value);
      expect(accessor(context)).toBe(value);
      expect(calls()).toBe(1);
      expect(accessor.has(context)).toBe(true);
      expect(accessor.release(context)).toBe(value);
      expect(accessor.has(context)).toBe(false);
    }
  });
});
