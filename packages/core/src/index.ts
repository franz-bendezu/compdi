export type Constructor<T = object> = new (...args: any[]) => T;
export type AsyncFactory<T, TArgs extends readonly unknown[] = readonly unknown[]> = (
  ...args: TArgs
) => Promise<T>;

function macroNotTransformed(name: string): never {
  throw new Error(
    `[compdi] Runtime call to ${name}. Configure unplugin-compdi to erase macro calls during build.`
  );
}

export function createSingleton<TCtor extends Constructor>(
  target: TCtor,
  deps: readonly unknown[]
): InstanceType<TCtor> {
  void target;
  void deps;
  return macroNotTransformed("createSingleton");
}

export function defineSingleton<TCtor extends Constructor>(
  target: TCtor,
  deps: readonly unknown[]
): () => InstanceType<TCtor> {
  void target;
  void deps;
  return macroNotTransformed("defineSingleton");
}

export function defineTransient<TCtor extends Constructor>(
  target: TCtor,
  deps: readonly unknown[]
): () => InstanceType<TCtor> {
  void target;
  void deps;
  return macroNotTransformed("defineTransient");
}

export function createLazySingleton<TCtor extends Constructor>(
  target: TCtor,
  deps: readonly unknown[]
): InstanceType<TCtor> {
  void target;
  void deps;
  return macroNotTransformed("createLazySingleton");
}

export function defineLazySingleton<TCtor extends Constructor>(
  target: TCtor,
  deps: readonly unknown[]
): () => InstanceType<TCtor> {
  void target;
  void deps;
  return macroNotTransformed("defineLazySingleton");
}

export function createAsyncSingleton<
  TDeps extends readonly unknown[],
  TResult,
  TFactory extends AsyncFactory<TResult, TDeps>
>(
  factory: TFactory,
  deps: TDeps
): Awaited<ReturnType<TFactory>> {
  void factory;
  void deps;
  return macroNotTransformed("createAsyncSingleton");
}

export function defineAsyncSingleton<
  TDeps extends readonly unknown[],
  TResult,
  TFactory extends AsyncFactory<TResult, TDeps>
>(
  factory: TFactory,
  deps: TDeps
): () => Promise<Awaited<ReturnType<TFactory>>> {
  void factory;
  void deps;
  return macroNotTransformed("defineAsyncSingleton");
}

export function defineAppTeardown(
  resources: readonly unknown[]
): () => Promise<void> {
  void resources;
  return macroNotTransformed("defineAppTeardown");
}
