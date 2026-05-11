export type Constructor<T = object> = new (...args: any[]) => T;
export type AsyncFactory<T> = () => Promise<T>;

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

export function createAsyncSingleton<TFactory extends AsyncFactory<any>>(
  factory: TFactory,
  deps: readonly unknown[]
): Awaited<ReturnType<TFactory>> {
  void factory;
  void deps;
  return macroNotTransformed("createAsyncSingleton");
}

export function defineAsyncSingleton<TFactory extends AsyncFactory<any>>(
  factory: TFactory,
  deps: readonly unknown[]
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
