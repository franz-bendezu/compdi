export type Replacement = {
  start: number;
  end: number;
  code: string;
};

export type BindingKind =
  | "create-singleton"
  | "define-singleton"
  | "define-singleton-lazy"
  | "create-transient"
  | "define-transient"
  | "create-scoped"
  | "define-scoped";

export type BindingInfo = {
  kind: BindingKind;
  instanceName: string;
  peekName?: string;
};
