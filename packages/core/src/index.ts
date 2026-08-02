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

/** Cleanup callback supported by scoped lifecycle options. */
export type ScopedReleaseHandler<T, K> = (
  instance: T,
  context: K
) => void | PromiseLike<void>;

/** Resolves the return type of `release` from a cleanup callback or result. */
export type ScopedReleaseResult<T, TOnRelease> = TOnRelease extends (
  ...args: never[]
) => infer TResult
  ? TResult extends PromiseLike<unknown>
    ? Promise<T | undefined>
    : T | undefined
  : TOnRelease extends PromiseLike<unknown>
    ? Promise<T | undefined>
    : T | undefined;

/** Shared non-creating lifecycle operations for scoped values. */
export interface ScopedLifecycle<T, K = unknown, TRelease = T | undefined> {
  /** Reports whether a value exists without creating one. */
  has(contextId: K): boolean;

  /** Returns an existing value without creating one. */
  peek(contextId: K): T | undefined;

  /**
   * Removes the cached value and performs configured cleanup. Its return type
   * is synchronous unless the configured cleanup returns a promise.
   */
  release(contextId: K): TRelease;
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
export interface ScopedAccessor<T, K = unknown, TRelease = T | undefined>
  extends ScopedLifecycle<T, K, TRelease> {
  (contextId: K): T;
}

/** Non-creating lifecycle operations returned alongside a scoped proxy. */
export interface ScopedController<T, K, TRelease = T | undefined>
  extends ScopedLifecycle<T, K, TRelease> {}

/** A stable object that forwards operations to the value for the active context. */
export type ScopedProxy<T extends object> = T;

/** Options for a stable contextual proxy created by {@link createScoped}. */
export interface ContextualScopedOptions<
  T extends object,
  K,
  TDeps extends readonly unknown[],
  TCleanupResult extends void | PromiseLike<void> = void,
> {
  target?: new (...deps: TDeps) => T;
  /** Creates the value for the active context. The resolved context is injected first. */
  factory?: (context: K, ...deps: TDeps) => T;
  deps?: TDeps;

  /** Returns the currently active context. It is called lazily on proxy operations. */
  context: () => K;

  /**
   * Optional cleanup invoked by `scope.release(context)` after the cached
   * value is removed. Its return type determines whether `release` is
   * synchronous or returns a promise.
   */
  onRelease?: (instance: T, context: K) => TCleanupResult;
}

/**
 * Options for a scoped accessor with automatic release cleanup. Synchronous
 * cleanup produces a synchronous `release`; asynchronous cleanup produces a
 * promise-returning `release`.
 */
export interface ReleasableScopedOptions<
  T,
  K,
  TDeps extends readonly unknown[],
  TCleanupResult extends void | PromiseLike<void>,
> {
  target?: new (...deps: TDeps) => T;
  factory?: (...deps: TDeps) => T;
  deps?: TDeps;
  onRelease: (instance: T, context: K) => TCleanupResult;
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
/**
 * Creates one eagerly initialized application-wide value from a class target or
 * factory. Async factories return a promise.
 *
 * @group Singleton
 * @example
 * ```ts
 * const database = createSingleton({ target: Database, deps: [config] });
 * ```
 */
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
/**
 * Defines an accessor for one application-wide value. Pass `lazy: true` to
 * defer construction until the first accessor call.
 *
 * @group Singleton
 * @example
 * ```ts
 * const useDatabase = defineSingleton({ target: Database, lazy: true });
 * const database = useDatabase();
 * ```
 */
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
/**
 * Defines a factory that constructs a fresh value on every call.
 *
 * @group Transient
 * @example
 * ```ts
 * const createService = createTransient({ target: Service, deps: [database] });
 * const service = createService();
 * ```
 */
export function createTransient<T>(options: DiOptions<T, any>): () => T | Promise<T> {
  void options;
  return macroNotTransformed("createTransient");
}

/**
 * Defines a factory that constructs a fresh value on every call.
 *
 * @group Transient
 * @example
 * ```ts
 * const createService = defineTransient({ target: Service, deps: [database] });
 * const service = createService();
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
 * Defines a factory that constructs a fresh value on every call.
 *
 * @example
 * ```ts
 * const createService = defineTransient({ target: Service, deps: [database] });
 * const service = createService();
 * ```
 */
export function defineTransient<T>(options: DiOptions<T, any>): () => T | Promise<T> {
  void options;
  return macroNotTransformed("defineTransient");
}

// createScoped: inferred from C/F, or explicit <T, K> for interface+context narrowing
/**
 * Creates a stable contextual proxy that resolves its active context lazily on
 * property operations.
 *
 * @example
 * ```ts
 * const [database, databaseScope] = createScoped({
 *   factory: (request, config) => createDatabase(request, config),
 *   deps: [config],
 *   context: useRequest,
 *   onRelease: database => database.close()
 * });
 * await databaseScope.release(request);
 * ```
 */
export function createScoped<
  T extends object,
  K,
  TDeps extends readonly unknown[],
  TCleanupResult extends void | PromiseLike<void>,
>(
  options: ContextualScopedOptions<T, K, TDeps, TCleanupResult> & {
    onRelease: (instance: T, context: K) => TCleanupResult;
  }
): readonly [
  ScopedProxy<T>,
  ScopedController<T, K, ScopedReleaseResult<T, TCleanupResult>>,
];
export function createScoped<
  T extends object,
  K,
  TDeps extends readonly unknown[],
>(
  options: ContextualScopedOptions<T, K, TDeps> & { onRelease?: undefined }
): readonly [ScopedProxy<T>, ScopedController<T, K>];
/**
 * Creates a stable object proxy that resolves one value per active context and
 * returns it with a non-creating lifecycle controller.
 *
 * @group Scoped
 * @example
 * ```ts
 * const [database, scope] = createScoped({
 *   factory: request => createDatabase(request),
 *   context: useRequest,
 * });
 * scope.release(request);
 * ```
 */
export function createScoped<T extends object, K, TDeps extends readonly unknown[]>(
  options: ContextualScopedOptions<T, K, TDeps, void | PromiseLike<void>>
): readonly [
  ScopedProxy<T>,
  ScopedController<T, K, T | undefined | Promise<T | undefined>>,
] {
  void options;
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
export function defineScoped<
  T,
  K,
  TDeps extends readonly unknown[],
  TCleanupResult extends void | PromiseLike<void>,
>(
  options: ReleasableScopedOptions<T, K, TDeps, TCleanupResult>
): ScopedAccessor<T, K, ScopedReleaseResult<T, TCleanupResult>>;
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
/**
 * Defines a keyed per-context accessor with `has`, `peek`, and `release`
 * lifecycle methods.
 *
 * @group Scoped
 * @example
 * ```ts
 * const useService = defineScoped<Service, Request>({
 *   target: Service,
 *   deps: [database],
 * });
 * const service = useService(request);
 * ```
 */
export function defineScoped<T>(options: DiOptions<T, any>): ScopedAccessor<T | Promise<T>> {
  void options;
  return macroNotTransformed("defineScoped");
}

/**
 * Defines an async teardown function that disposes the supplied resources in
 * reverse order. Supported disposal protocols are resolved at build time.
 *
 * This macro is experimental and may be removed in a future release.
 *
 * @group Lifecycle
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
