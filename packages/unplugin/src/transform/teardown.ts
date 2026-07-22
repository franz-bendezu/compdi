import type { DeclarationMacroMatch, MacroMatch } from "./context";
import { resolveTeardownResource } from "./context";
import type { MacroGenerationContext } from "./generation";

type TeardownMatch = Extract<MacroMatch, { macroName: "defineAppTeardown" }>;

export function generateTeardownExpression(match: TeardownMatch, generation: MacroGenerationContext, indent = ""): string {
  const lines = (match.resources ?? []).flatMap((node, index) => {
    const raw = generation.renderNode(node);
    const resolved = resolveTeardownResource(node.type === "Identifier" ? node.name : raw, generation.module.bindings);
    const local = `__resource_${index}`;
    return [
      `${indent}  const ${local} = ${resolved.awaitExpression ? `await ${resolved.expression}` : resolved.expression};`,
      `${indent}  if (${local} != null && Symbol.asyncDispose in ${local}) {`,
      `${indent}    // @ts-ignore`, `${indent}    tasks.push(${local}[Symbol.asyncDispose]());`,
      `${indent}  } else if (${local} != null && Symbol.dispose in ${local}) {`, `${indent}    try {`,
      `${indent}      // @ts-ignore`, `${indent}      ${local}[Symbol.dispose]();`, `${indent}    } catch (error) {`,
      `${indent}      tasks.push(Promise.reject(error));`, `${indent}    }`, `${indent}  }`
    ];
  });
  return [`${indent}async () => {`, `${indent}  const tasks = [];`, ...lines, `${indent}  await Promise.allSettled(tasks);`, `${indent}}`].join("\n");
}

export function generateTeardownDeclaration(match: TeardownMatch & DeclarationMacroMatch, generation: MacroGenerationContext): string {
  return `${match.exported ? "export " : ""}const ${match.name} = ${generateTeardownExpression(match, generation)};`;
}
