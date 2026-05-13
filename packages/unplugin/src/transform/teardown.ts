import { splitDependencyList } from "./shared";
import { TEARDOWN_REGEX, resolveTeardownResource } from "./context";
import type { BindingInfo, Replacement } from "./types";

export function collectTeardownReplacements(
  code: string,
  bindings: ReadonlyMap<string, BindingInfo>
): Replacement[] {
  const replacements: Replacement[] = [];

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

    replacements.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      code: [
        `export const ${name} = async () => {`,
        `  const tasks = [];`,
        ...lines,
        `  await Promise.allSettled(tasks);`,
        `};`
      ].join("\n")
    });
  }

  return replacements;
}
