import type MagicString from "magic-string";
import { splitDependencyList } from "./shared";
import { TEARDOWN_REGEX, resolveTeardownResource } from "./context";
import type { BindingInfo } from "./types";

export function collectTeardownReplacements(
  code: string,
  bindings: ReadonlyMap<string, BindingInfo>,
  ms: MagicString
): boolean {
  let found = false;

  for (const match of code.matchAll(TEARDOWN_REGEX)) {
    const name = match[1];
    const resources = splitDependencyList(match[2]);

    const lines = resources.flatMap((resource, index) => {
      const resolved = resolveTeardownResource(resource, bindings);
      const localName = `__resource_${index}`;

      return [
        `  const ${localName} = ${resolved.awaitExpression ? `await ${resolved.expression}` : resolved.expression};`,
        `  if (${localName} != null && Symbol.asyncDispose in ${localName}) {`,
        `    // @ts-ignore`,
        `    tasks.push(${localName}[Symbol.asyncDispose]());`,
        `  } else if (${localName} != null && Symbol.dispose in ${localName}) {`,
        `    try {`,
        `      // @ts-ignore`,
        `      ${localName}[Symbol.dispose]();`,
        `    } catch (error) {`,
        `      tasks.push(Promise.reject(error));`,
        `    }`,
        `  }`
      ];
    });

    const start = match.index ?? 0;
    const end = start + match[0].length;
    ms.overwrite(start, end, [
      `export const ${name} = async () => {`,
      `  const tasks = [];`,
      ...lines,
      `  await Promise.allSettled(tasks);`,
      `};`
    ].join("\n"));
    found = true;
  }

  return found;
}
