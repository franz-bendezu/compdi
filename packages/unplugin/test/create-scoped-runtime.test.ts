import { createScoped } from "@compdi/core";
import { describe, expect, it } from "vitest";

interface RequestContext {
  id: number;
}

class Resource {
  value = 1;

  constructor(readonly contextId: number) {}

  get doubled(): number {
    return this.value * 2;
  }

  increment(): number {
    return ++this.value;
  }
}

let activeContext: RequestContext = { id: 1 };
let contextCalls = 0;
let factoryCalls = 0;
const disposed: Resource[] = [];

export const [resource, resourceScope] = createScoped({
  factory: () => new Resource(++factoryCalls),
  context: () => {
    contextCalls++;
    return activeContext;
  },
  onRelease: async (instance) => {
    await Promise.resolve();
    disposed.push(instance);
  }
});

export const [resourceWithoutCleanup, resourceWithoutCleanupScope] = createScoped({
  factory: () => new Resource(0),
  context: () => activeContext
});

describe("contextual createScoped runtime behavior", () => {
  it("is stable and resolves contexts and factories lazily", () => {
    const stable = resource;
    expect(resource).toBe(stable);
    expect(contextCalls).toBe(0);
    expect(factoryCalls).toBe(0);

    expect(resourceScope.has(activeContext)).toBe(false);
    expect(resourceScope.peek(activeContext)).toBeUndefined();
    expect(contextCalls).toBe(0);
    expect(factoryCalls).toBe(0);
  });

  it("caches per context and forwards object operations", () => {
    const firstContext = activeContext;
    expect(resource.increment()).toBe(2);
    const first = resourceScope.peek(firstContext)!;
    expect(first.value).toBe(2);
    expect(resource.doubled).toBe(4);

    resource.value = 5;
    expect(first.value).toBe(5);
    expect("value" in resource).toBe(true);
    expect(Reflect.ownKeys(resource)).toContain("value");
    expect(Object.getOwnPropertyDescriptor(resource, "value")?.value).toBe(5);

    activeContext = { id: 2 };
    expect(resource.value).toBe(1);
    const second = resourceScope.peek(activeContext)!;
    expect(second).not.toBe(first);

    activeContext = firstContext;
    expect(resource.value).toBe(5);
  });

  it("releases without creating and recreates after release", async () => {
    const unused = { id: 999 };
    const callsBefore = factoryCalls;
    expect(await resourceScope.release(unused)).toBeUndefined();
    expect(factoryCalls).toBe(callsBefore);

    const context = activeContext;
    const existing = resourceScope.peek(context)!;
    expect(await resourceScope.release(context)).toBe(existing);
    expect(resourceScope.peek(context)).toBeUndefined();
    expect(resource.value).toBe(1);
    expect(resourceScope.peek(context)).not.toBe(existing);
  });

  it("runs cleanup once and permits omitted cleanup", async () => {
    const context = activeContext;
    const existing = resourceScope.peek(context)!;
    const disposedBefore = disposed.length;
    expect(await resourceScope.release(context)).toBe(existing);
    expect(disposed).toHaveLength(disposedBefore + 1);
    expect(disposed.at(-1)).toBe(existing);
    expect(await resourceScope.release(context)).toBeUndefined();
    expect(disposed).toHaveLength(disposedBefore + 1);

    expect(resourceWithoutCleanup.value).toBe(1);
    const releasedWithoutCleanup = resourceWithoutCleanupScope.release(context);
    expect(releasedWithoutCleanup).toBeInstanceOf(Resource);
  });
});
