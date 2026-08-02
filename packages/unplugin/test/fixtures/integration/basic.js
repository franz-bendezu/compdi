import { createSingleton, createTransient, defineSingleton } from "@compdi/core";

class Counter {
  value = 0;
}

const counter = createSingleton({ target: Counter });
const useCounter = defineSingleton({ factory: () => counter, lazy: true });
const createValue = createTransient({ factory: (base) => ({ value: base + 1 }), deps: [41] });

export const result = {
  singleton: useCounter() === useCounter(),
  transient: createValue() !== createValue(),
  value: createValue().value
};
