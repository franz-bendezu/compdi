import type MagicString from "magic-string";
import type { ImportDeclarationSpecifier } from "oxc-parser";
import type { TransformContext } from "./context";

export function collectImportReplacements(context: TransformContext, ms: MagicString): void {
  for (const entry of context.imports) {
    const remove = new Set<ImportDeclarationSpecifier>(entry.macroSpecifiers);
    const keep = entry.specifiers.filter((specifier) => !remove.has(specifier));
    if (!keep.length) {
      let end = entry.node.end;
      while (end < context.code.length && /\s/.test(context.code[end])) end += 1;
      ms.remove(entry.node.start, end);
      continue;
    }
    // Rebuild only the specifier list. This keeps import attributes and the
    // original module quote style while avoiding comma-range edge cases.
    const first = entry.specifiers[0];
    const last = entry.specifiers.at(-1)!;
    ms.overwrite(first.start, last.end, keep.map((specifier) => context.code.slice(specifier.start, specifier.end)).join(", "));
  }
}
