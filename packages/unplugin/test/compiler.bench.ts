import { bench, describe } from "vitest";
import { transformCompdiMacros } from "../src/transform";

const flatModule = (count: number): string => [
  'import { defineTransient } from "@compdi/core";',
  "class Service {}",
  ...Array.from({ length: count }, (_, index) =>
    `export const service${index} = defineTransient({ target: Service, deps: [] });`)
].join("\n");

const graphModule = (count: number): string => [
  'import { defineTransient } from "@compdi/core";',
  "class Service {}",
  ...Array.from({ length: count }, (_, index) =>
    `export const service${index} = defineTransient({ target: Service, deps: [${index ? `service${index - 1}` : ""}] });`)
].join("\n");

const nestedModule = (count: number): string => [
  'import { createSingleton } from "@compdi/core";',
  "class Service {}",
  `export const value = ${"createSingleton({ target: Service, deps: [".repeat(count)}undefined${"] })".repeat(count)};`
].join("\n");

describe("compiler transform", () => {
  const miss = 'import { type SingletonOptions } from "@compdi/core";\nexport const value = 1;';
  const flat100 = flatModule(100);
  const flat500 = flatModule(500);
  const graph100 = graphModule(100);
  const nested80 = nestedModule(80);

  bench("fast miss", () => { transformCompdiMacros(miss, "miss.ts"); });
  bench("100 flat macros", () => { transformCompdiMacros(flat100, "flat-100.ts"); });
  bench("500 flat macros", () => { transformCompdiMacros(flat500, "flat-500.ts"); });
  bench("100-node dependency graph", () => { transformCompdiMacros(graph100, "graph-100.ts"); });
  bench("80 nested macros", () => { transformCompdiMacros(nested80, "nested-80.ts"); });
  bench("high-resolution source map", () => { transformCompdiMacros(flat100, "hires.ts", "hires"); });
  bench("boundary source map", () => { transformCompdiMacros(flat100, "boundary.ts", "boundary"); });
  bench("source map disabled", () => { transformCompdiMacros(flat100, "disabled.ts", false); });
});
