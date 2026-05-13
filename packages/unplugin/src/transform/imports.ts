import type MagicString from "magic-string";
import { CORE_IMPORT_REGEX } from "./context";

export function collectImportReplacements(code: string, ms: MagicString): void {
  for (const match of code.matchAll(CORE_IMPORT_REGEX)) {
    const start = match.index ?? 0;
    ms.remove(start, start + match[0].length);
  }
}
