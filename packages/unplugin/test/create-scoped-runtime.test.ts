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

const secretKey = Symbol("secret");

class FrozenResource {
  #secret = 41;
  readonly visible = 1;
  readonly [secretKey] = "symbol-value";

  reveal(): number {
    return ++this.#secret;
  }
}

let activeContext: RequestContext = { id: 1 };
let contextCalls = 0;
let factoryCalls = 0;
const disposed: Resource[] = [];

export const [resource, resourceScope] = createScoped({
  factory: (context) => {
    factoryCalls++;
    return new Resource(context.id);
  },
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

export const [frozenResource] = createScoped({
  factory: () => Object.freeze(new FrozenResource()),
  context: () => activeContext
});

export const [mutableResource] = createScoped({
  factory: () => ({ removable: true, retained: true }),
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
    expect(first.contextId).toBe(firstContext.id);
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
    expect(second.contextId).toBe(activeContext.id);
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

  it("preserves proxy invariants for frozen instances and symbol properties", () => {
    expect(frozenResource).toBeInstanceOf(FrozenResource);
    expect(frozenResource.reveal()).toBe(42);
    expect(frozenResource[secretKey]).toBe("symbol-value");
    expect(Reflect.ownKeys(frozenResource)).toContain(secretKey);

    const descriptor = Object.getOwnPropertyDescriptor(frozenResource, "visible");
    expect(descriptor).toMatchObject({ value: 1, enumerable: true, configurable: true });
    expect(Object.keys(frozenResource)).toContain("visible");
  });

  it("forwards property deletion to the active instance", () => {
    expect("removable" in mutableResource).toBe(true);
    expect(Reflect.deleteProperty(mutableResource, "removable")).toBe(true);
    expect("removable" in mutableResource).toBe(false);
    expect(mutableResource.retained).toBe(true);
  });
});
