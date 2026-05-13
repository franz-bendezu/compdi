import { CORE_IMPORT_REGEX } from "./context";
import type { Replacement } from "./types";

export function collectImportReplacements(code: string, out: Replacement[]): void {
  for (const match of code.matchAll(CORE_IMPORT_REGEX)) {
    out.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      code: ""
    });
  }
}
