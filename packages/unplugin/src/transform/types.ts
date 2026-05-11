export type Replacement = {
  start: number;
  end: number;
  code: string;
};

export type BindingKind =
  | "create-singleton"
  | "define-singleton"
  | "create-lazy-singleton"
  | "define-lazy-singleton"
  | "create-async-singleton"
  | "define-async-singleton";

export type BindingInfo = {
  kind: BindingKind;
  instanceName: string;
  getterName?: string;
  peekName?: string;
  promiseName?: string;
};
