import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build as esbuild } from "esbuild";
import { rspack } from "@rspack/core";
import { rolldown } from "rolldown";
import { rollup } from "rollup";
import { build as viteBuild } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import esbuildPlugin from "../src/esbuild";
import rolldownPlugin from "../src/rolldown";
import rollupPlugin from "../src/rollup";
import rspackPlugin from "../src/rspack";
import vitePlugin from "../src/vite";

const entry = new URL("./fixtures/integration/basic.js", import.meta.url).pathname;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function verify(code: string, extension = "mjs"): Promise<void> {
  expect(code).not.toContain("@compdi/core");
  expect(code).not.toMatch(/\b(?:create|define)(?:Singleton|Transient|Scoped)\s*\(/);

  const directory = await mkdtemp(join(tmpdir(), "compdi-integration-"));
  temporaryDirectories.push(directory);
  const output = join(directory, `output.${extension}`);
  await import("node:fs/promises").then(({ writeFile }) => writeFile(output, code));
  const module = await import(`${pathToFileURL(output).href}?${Date.now()}`);
  expect(module.result ?? module.default?.result).toEqual({ singleton: true, transient: true, value: 42 });
}

describe("bundler integrations", () => {
  it("builds with Vite", async () => {
    const result = await viteBuild({
      configFile: false,
      logLevel: "silent",
      plugins: [vitePlugin()],
      build: { write: false, lib: { entry, formats: ["es"] } }
    });
    if (!("output" in result) && !Array.isArray(result)) throw new Error("Vite unexpectedly entered watch mode");
    const outputs = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
    const chunk = outputs.find((item) => item.type === "chunk");
    expect(chunk?.type).toBe("chunk");
    await verify(chunk?.type === "chunk" ? chunk.code : "");
  });

  it("builds with Rollup", async () => {
    const bundle = await rollup({ input: entry, plugins: [rollupPlugin()] });
    const { output } = await bundle.generate({ format: "es" });
    await bundle.close();
    const chunk = output.find((item) => item.type === "chunk");
    await verify(chunk?.type === "chunk" ? chunk.code : "");
  });

  it("builds with Rolldown", async () => {
    const bundle = await rolldown({ input: entry, plugins: [rolldownPlugin()] });
    const { output } = await bundle.generate({ format: "es" });
    await bundle.close();
    const chunk = output.find((item) => item.type === "chunk");
    await verify(chunk?.type === "chunk" ? chunk.code : "");
  });

  it("builds with esbuild", async () => {
    const result = await esbuild({
      entryPoints: [entry],
      bundle: true,
      format: "esm",
      plugins: [esbuildPlugin()],
      write: false
    });
    await verify(result.outputFiles[0]?.text ?? "");
  });

  it("builds with Rspack", async () => {
    const directory = await mkdtemp(join(tmpdir(), "compdi-rspack-"));
    temporaryDirectories.push(directory);
    const compiler = rspack({
      mode: "production",
      target: "node",
      entry,
      plugins: [rspackPlugin()],
      output: { path: directory, filename: "output.cjs", library: { type: "commonjs2" } }
    });

    await new Promise<void>((resolve, reject) => {
      compiler.run((error, stats) => {
        if (error) return reject(error);
        if (stats?.hasErrors()) return reject(new Error(stats.toString({ errors: true })));
        compiler.close((closeError) => closeError ? reject(closeError) : resolve());
      });
    });

    await verify(await readFile(join(directory, "output.cjs"), "utf8"), "cjs");
  });
});
