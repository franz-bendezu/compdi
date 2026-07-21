export interface DiOptions<T, TDeps extends readonly unknown[]> {
  /** The class constructor to instantiate. Generates `new target(...deps)` */
  target?: new (...args: TDeps) => T;

  /** The factory function to invoke. Generates `factory(...deps)` */
  factory?: (...args: TDeps) => T | Promise<T>;

  /** Array of dependencies to inject. */
  deps?: TDeps;

  /** Initialization strategy. Defaults to false (eager). Valid for Singletons. */
  lazy?: boolean;
}

/** Accessor returned by defineScoped, including non-creating lifecycle operations. */
export interface ScopedAccessor<T, K = unknown> {
  (contextId: K): T;
  has(contextId: K): boolean;
  peek(contextId: K): T | undefined;
  release(contextId: K): T | undefined;
}

function macroNotTransformed(name: string): never {
  throw new Error(
    `[compdi] Runtime call to ${name}. Configure unplugin-compdi to erase macro calls during build.`
  );
}

// createSingleton: async factory -> Promise<T>, class target -> T, sync factory -> T
// Overload 1 & 3: inferred from C/F directly (no T needed)
export function createSingleton<C extends new (...args: any[]) => any>(
  options: { target: C; deps?: NoInfer<ConstructorParameters<C>>; lazy?: boolean }
): InstanceType<C>;
export function createSingleton<F extends (...args: any[]) => Promise<any>>(
  options: { factory: F; deps?: NoInfer<Parameters<F>>; lazy?: boolean }
): ReturnType<F>;
export function createSingleton<F extends (...args: any[]) => any>(
  options: { factory: F; deps?: NoInfer<Parameters<F>>; lazy?: boolean }
): ReturnType<F>;
// Overload 4+: explicit T for interface narrowing (deps loosely typed)
export function createSingleton<T>(
  options: { target: new (...args: any[]) => T; deps?: readonly any[]; lazy?: boolean }
): T;
export function createSingleton<T>(
  options: { factory: (...args: any[]) => Promise<T>; deps?: readonly any[]; lazy?: boolean }
): Promise<T>;
export function createSingleton<T>(
  options: { factory: (...args: any[]) => T; deps?: readonly any[]; lazy?: boolean }
): T;
export function createSingleton<T>(options: DiOptions<T, any>): T | Promise<T> {
  void options;
  return macroNotTransformed("createSingleton");
}

// defineSingleton:
//   inferred async factory  ->  () => ReturnType<F>  (getter holds the Promise; no await on call site)
//   inferred sync factory   ->  () => ReturnType<F>
//   explicit <T> async      ->  Promise<() => T>     (must await call site; getter is synchronous)
//   explicit <T> sync       ->  () => T
export function defineSingleton<C extends new (...args: any[]) => any>(
  options: { target: C; deps?: NoInfer<ConstructorParameters<C>>; lazy?: boolean }
): () => InstanceType<C>;
export function defineSingleton<F extends (...args: any[]) => any>(
  options: { factory: F; deps?: NoInfer<Parameters<F>>; lazy?: boolean }
): () => ReturnType<F>;
export function defineSingleton<T>(
  options: { target: new (...args: any[]) => T; deps?: readonly any[]; lazy?: boolean }
): () => T;
export function defineSingleton<T>(
  options: { factory: (...args: any[]) => Promise<T>; deps?: readonly any[]; lazy?: boolean }
): Promise<() => T>;
export function defineSingleton<T>(
  options: { factory: (...args: any[]) => T; deps?: readonly any[]; lazy?: boolean }
): () => T;
export function defineSingleton<T>(options: DiOptions<T, any>): (() => T) | Promise<() => T> {
  void options;
  return macroNotTransformed("defineSingleton");
}

// createTransient: async factory -> () => Promise<T>, class target -> () => T, sync factory -> () => T
export function createTransient<C extends new (...args: any[]) => any>(
  options: { target: C; deps?: NoInfer<ConstructorParameters<C>> }
): () => InstanceType<C>;
export function createTransient<F extends (...args: any[]) => Promise<any>>(
  options: { factory: F; deps?: NoInfer<Parameters<F>> }
): () => ReturnType<F>;
export function createTransient<F extends (...args: any[]) => any>(
  options: { factory: F; deps?: NoInfer<Parameters<F>> }
): () => ReturnType<F>;
export function createTransient<T>(
  options: { target: new (...args: any[]) => T; deps?: readonly any[] }
): () => T;
export function createTransient<T>(
  options: { factory: (...args: any[]) => Promise<T>; deps?: readonly any[] }
): () => Promise<T>;
export function createTransient<T>(
  options: { factory: (...args: any[]) => T; deps?: readonly any[] }
): () => T;
export function createTransient<T>(options: DiOptions<T, any>): () => T | Promise<T> {
  void options;
  return macroNotTransformed("createTransient");
}

// defineTransient: deprecated alias of createTransient
/**
 * @deprecated Use createTransient instead. defineTransient is kept as an alias
 * during alpha and may be removed in a future release.
 */
export function defineTransient<C extends new (...args: any[]) => any>(
  options: { target: C; deps?: NoInfer<ConstructorParameters<C>> }
): () => InstanceType<C>;
export function defineTransient<F extends (...args: any[]) => Promise<any>>(
  options: { factory: F; deps?: NoInfer<Parameters<F>> }
): () => ReturnType<F>;
export function defineTransient<F extends (...args: any[]) => any>(
  options: { factory: F; deps?: NoInfer<Parameters<F>> }
): () => ReturnType<F>;
export function defineTransient<T>(
  options: { target: new (...args: any[]) => T; deps?: readonly any[] }
): () => T;
export function defineTransient<T>(
  options: { factory: (...args: any[]) => Promise<T>; deps?: readonly any[] }
): () => Promise<T>;
export function defineTransient<T>(
  options: { factory: (...args: any[]) => T; deps?: readonly any[] }
): () => T;
/**
 * @deprecated Use createTransient instead. defineTransient is kept as an alias
 * during alpha and may be removed in a future release.
 */
export function defineTransient<T>(options: DiOptions<T, any>): () => T | Promise<T> {
  void options;
  return macroNotTransformed("defineTransient");
}

// createScoped: inferred from C/F, or explicit <T, K> for interface+context narrowing
export function createScoped<C extends new (...args: any[]) => any>(
  options: { target: C; deps?: NoInfer<ConstructorParameters<C>> },
  contextId: unknown
): InstanceType<C>;
export function createScoped<F extends (...args: any[]) => Promise<any>>(
  options: { factory: F; deps?: NoInfer<Parameters<F>> },
  contextId: unknown
): ReturnType<F>;
export function createScoped<F extends (...args: any[]) => any>(
  options: { factory: F; deps?: NoInfer<Parameters<F>> },
  contextId: unknown
): ReturnType<F>;
export function createScoped<T, K = unknown>(
  options: { target: new (...args: any[]) => T; deps?: readonly any[] },
  contextId: K
): T;
export function createScoped<T, K = unknown>(
  options: { factory: (...args: any[]) => Promise<T>; deps?: readonly any[] },
  contextId: K
): Promise<T>;
export function createScoped<T, K = unknown>(
  options: { factory: (...args: any[]) => T; deps?: readonly any[] },
  contextId: K
): T;
export function createScoped<T>(options: DiOptions<T, any>, contextId: unknown): T | Promise<T> {
  void options;
  void contextId;
  return macroNotTransformed("createScoped");
}

// defineScoped: inferred from C/F, or explicit <T, K> for interface+context narrowing
export function defineScoped<C extends new (...args: any[]) => any>(
  options: { target: C; deps?: NoInfer<ConstructorParameters<C>> }
): ScopedAccessor<InstanceType<C>>;
export function defineScoped<F extends (...args: any[]) => Promise<any>>(
  options: { factory: F; deps?: NoInfer<Parameters<F>> }
): ScopedAccessor<ReturnType<F>>;
export function defineScoped<F extends (...args: any[]) => any>(
  options: { factory: F; deps?: NoInfer<Parameters<F>> }
): ScopedAccessor<ReturnType<F>>;
export function defineScoped<T, K = unknown>(
  options: { target: new (...args: any[]) => T; deps?: readonly any[] }
): ScopedAccessor<T, K>;
export function defineScoped<T, K = unknown>(
  options: { factory: (...args: any[]) => Promise<T>; deps?: readonly any[] }
): ScopedAccessor<Promise<T>, K>;
export function defineScoped<T, K = unknown>(
  options: { factory: (...args: any[]) => T; deps?: readonly any[] }
): ScopedAccessor<T, K>;
export function defineScoped<T>(options: DiOptions<T, any>): ScopedAccessor<T | Promise<T>> {
  void options;
  return macroNotTransformed("defineScoped");
}

export function defineAppTeardown(
  resources: readonly unknown[]
): () => Promise<void> {
  void resources;
  return macroNotTransformed("defineAppTeardown");
}
