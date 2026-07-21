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

/**
 * Accessor returned by {@link defineScoped}.
 *
 * Calling the accessor creates a value when its context has no entry. The
 * lifecycle methods inspect or remove entries without invoking the factory.
 *
 * @example Releasing a request-scoped database resource
 * ```ts
 * const resource = useScopedDatabaseResource.release(request);
 * if (resource) {
 *   await resource.connected;
 *   await resource.client.end();
 * }
 * ```
 */
export interface ScopedAccessor<T, K = unknown> {
  (contextId: K): T;

  /** Reports whether a value exists without creating one. */
  has(contextId: K): boolean;

  /** Returns an existing value without creating one. */
  peek(contextId: K): T | undefined;

  /** Removes and returns an existing value without creating one. */
  release(contextId: K): T | undefined;
}

function macroNotTransformed(name: string): never {
  throw new Error(
    `[compdi] Runtime call to ${name}. Configure unplugin-compdi to erase macro calls during build.`
  );
}

// createSingleton: async factory -> Promise<T>, class target -> T, sync factory -> T
// Overload 1 & 3: inferred from C/F directly (no T needed)
/**
 * Creates one eagerly initialized application-wide value.
 *
 * @example
 * ```ts
 * const database = createSingleton({ target: Database, deps: [config] });
 * ```
 */
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
/**
 * Defines an accessor for one application-wide value.
 * Pass `lazy: true` to defer construction until the first accessor call.
 *
 * @example
 * ```ts
 * const useDatabase = defineSingleton({ target: Database, deps: [config], lazy: true });
 * const database = useDatabase();
 * ```
 */
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
/**
 * Creates a factory that constructs a fresh value on every call.
 *
 * @example
 * ```ts
 * const createService = createTransient({ target: Service, deps: [database] });
 * const service = createService();
 * ```
 */
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
 * Defines a factory that constructs a fresh value on every call.
 *
 * @deprecated Use createTransient instead. defineTransient is kept as an alias
 * during alpha and may be removed in a future release.
 *
 * @example
 * ```ts
 * const createService = defineTransient({ target: Service, deps: [database] });
 * ```
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
/**
 * Returns the value associated with a context, creating it when absent.
 * Repeated calls from the same generated binding and context reuse the value.
 *
 * @example
 * ```ts
 * const service = createScoped({ target: Service, deps: [database] }, request);
 * ```
 */
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
/**
 * Defines a per-context accessor with non-creating inspection and release
 * operations. See {@link ScopedAccessor} for lifecycle methods.
 *
 * @example
 * ```ts
 * const useService = defineScoped<Service, Request>({
 *   target: Service,
 *   deps: [database]
 * });
 * const service = useService(request);
 * ```
 */
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

/**
 * Defines an async teardown function that disposes the supplied resources in
 * reverse order. Supported disposal protocols are resolved at build time.
 *
 * @example
 * ```ts
 * const teardown = defineAppTeardown([server, database]);
 * await teardown();
 * ```
 */
export function defineAppTeardown(
  resources: readonly unknown[]
): () => Promise<void> {
  void resources;
  return macroNotTransformed("defineAppTeardown");
}
