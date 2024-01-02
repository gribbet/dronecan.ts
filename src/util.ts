export type Index<T, Key> = Key extends keyof T ? T[Key] : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any;

export type Find<
  Array extends readonly Any[],
  Key extends keyof Array[number],
  Value extends string,
> = {
  [I in keyof Array as Index<Array[I], Key> extends Value
    ? Index<Array[I], Key>
    : never]: Array[I];
};

export const keys = <T extends object>(value: T) =>
  Object.keys(value) as (keyof T)[];

export const append = (a: Uint8Array, b: Uint8Array) => {
  const c = new Uint8Array(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
};

export const range = (start: number, end: number) =>
  Array.from({ length: end - start }, (_, k) => k + start);

export const camelToSnakeCase = (value: string) =>
  value.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

// eslint-disable-next-line func-style
export async function* map<T, U>(
  iterable: AsyncIterable<T>,
  f: (value: T) => U | Promise<U>,
) {
  for await (const item of iterable) yield f(item);
}

// eslint-disable-next-line no-async-without-await/no-async-without-await
export const exhaust = async <T>(iterable: AsyncIterable<T>) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of iterable) {
    //
  }
};

export const assert = <T>(value: T | undefined) => {
  if (value === undefined) throw new Error("unexpected");
  return value;
};
