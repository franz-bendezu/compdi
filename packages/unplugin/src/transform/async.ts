// Async singletons are no longer a separate macro. Async factories are
// supported via TypeScript overloads on createSingleton/defineSingleton.
// The transformer handles them transparently.

import type { BindingInfo, Replacement } from "./types";

/**
 * @deprecated No-op. Async handling is merged into the main singleton transformer.
 */
export function collectAsyncSingletonReplacements(
  _code: string,
  _bindings: ReadonlyMap<string, BindingInfo>,
  _mode: "create" | "define"
): Replacement[] {
  return [];
}

