export type Index<T, Key> = Key extends keyof T ? T[Key] : never;

// deno-lint-ignore no-explicit-any
export type Any = any;

export type Find<
  Array extends readonly Any[],
  Key extends keyof Array[number],
  Value extends string
> = {
  [I in keyof Array as Index<Array[I], Key> extends Value
    ? Index<Array[I], Key>
    : never]: Array[I];
};

export const keys = <T extends object>(value: T) =>
  Object.keys(value) as (keyof T)[];

export const delay = (timeout = 0) =>
  new Promise((resolve) => setTimeout(resolve, timeout));

export const append = (a: Uint8Array, b: Uint8Array) => {
  const c = new Uint8Array(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
};

export const range = (start: number, end: number) =>
  Array.from({ length: end - start }, (_, k) => k + start);

export const camelToSnakeCase = (value: string) =>
  value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

export const signal = <T = void>() => {
  let onTrigger: ((value: T) => void) | undefined;
  const signal = new Promise<T>((resolve) => {
    onTrigger = resolve;
  });
  function trigger(value: T) {
    onTrigger?.(value);
  }
  return [signal, trigger] as const;
};

export async function* map<T, U>(
  iterable: AsyncIterable<T>,
  f: (value: T) => U | Promise<U>
) {
  for await (const item of iterable) yield f(item);
}

export async function* flatMap<T, U>(
  iterable: AsyncIterable<T>,
  f: (value: T) => U[] | Promise<U[]>
) {
  for await (const item of iterable)
    for await (const value of await f(item)) yield value;
}

export async function* iterator<T>(f: () => T | Promise<T>) {
  while (true) yield await f();
}

export const exhaust = async <T>(iterable: AsyncIterable<T>) => {
  for await (const _ of iterable) {
    //
  }
};

export const createQueue = <T>() => {
  const values: T[] = [];
  const waiting: ((value: T) => void)[] = [];

  return {
    push: (value: T) => {
      values.push(value);
      const next = waiting.shift();
      if (next) next(value);
    },
    async *[Symbol.asyncIterator]() {
      while (true) {
        const next = values.shift();
        if (next) yield next;
        else await new Promise<T>((resolve) => waiting.push(resolve));
      }
    },
  };
};
