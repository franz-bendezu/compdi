// Lazy singletons are now handled as `defineSingleton({ ..., lazy: true })`.
// See singletons.ts for the generation logic.

import type { BindingInfo, Replacement } from "./types";

/**
 * @deprecated Lazy singletons are now handled inside collectSingletonReplacements.
 */
export function collectLazyReplacements(
  _code: string,
  _bindings: ReadonlyMap<string, BindingInfo>
): Replacement[] {
  return [];
}

