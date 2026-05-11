import { CORE_IMPORT_REGEX } from "./context";
import type { Replacement } from "./types";

export function collectImportReplacements(code: string): Replacement[] {
  const replacements: Replacement[] = [];

  for (const match of code.matchAll(CORE_IMPORT_REGEX)) {
    replacements.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      code: ""
    });
  }

  return replacements;
}
