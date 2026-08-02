import { defineSingleton } from "@compdi/core";
import { describe, expect, it } from "vitest";

function lazyValue<T>(value: T): [() => T, () => number] {
  let calls = 0;
  const useValue = defineSingleton({
    factory: () => {
      calls++;
      return value;
    },
    lazy: true
  });
  return [useValue, () => calls];
}

describe("lazy singleton falsy values", () => {
  it.each([
    [false],
    [0],
    [""],
    [null],
    [undefined],
    [Number.NaN]
  ])("caches %j after the first access", (value) => {
    const [useValue, calls] = lazyValue(value);

    expect(useValue()).toBe(value);
    expect(useValue()).toBe(value);
    expect(calls()).toBe(1);
  });
});
