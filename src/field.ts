import { getFloat16, setFloat16 } from "@petamoriken/float16";

import type { BitReader, BitWriter } from "./bits";
import type { DefinitionType, TypeDefinition } from "./definition";
import { decodeType, encodeType } from "./definition";
import type { MessageDefinition } from "./specification";
import type { Any } from "./util";
import { assert, keys, range } from "./util";

export const union = Symbol();

export type Field<T> = {
  dsdl: string;
  signature?: bigint;
  maximumBits: number;
  encode: (bits: BitWriter, value: T, tailArrayOptimization?: "tao") => void;
  decode: (bits: BitReader, tailArrayOptimization?: "tao") => T;
};

export type FieldType<T> = T extends Field<infer U> ? U : never;

type Cast = "saturated" | "truncated";

export const _void = (count: number) => {
  const dsdl = `void${count}`;
  const maximumBits = count;
  const encode = (bits: BitWriter) => bits.write(count, 0);
  const decode = (bits: BitReader) => {
    bits.read(count);
  };
  return { dsdl, maximumBits, encode, decode } satisfies Field<void>;
};

export const uint = (count: number, cast: Cast = "saturated") => {
  const dsdl = `${cast} uint${count}`;
  const maximumBits = count;
  const encode = (bits: BitWriter, value: number) => bits.write(count, value);
  const decode = (bits: BitReader) => Number(bits.read(count));
  return { dsdl, maximumBits, encode, decode } satisfies Field<number>;
};

export const int = (count: number, cast: Cast = "saturated") => {
  const dsdl = `${cast} int${count}`;
  const maximumBits = count;
  const signBit = 1n << BigInt(count - 1);
  const fullBitRange = 1n << BigInt(count);
  const encode = (bits: BitWriter, value: number) => {
    const bigValue = BigInt(Math.trunc(value));
    bits.write(count, bigValue < 0n ? fullBitRange + bigValue : bigValue);
  };
  const decode = (bits: BitReader) => {
    const value = bits.read(count);
    return Number(value & signBit ? value - fullBitRange : value);
  };
  return { dsdl, maximumBits, encode, decode } satisfies Field<number>;
};

export const biguint = (count: number, cast: Cast = "saturated") => {
  const dsdl = `${cast} uint${count}`;
  const maximumBits = count;
  const encode = (bits: BitWriter, value: bigint) => bits.write(count, value);
  const decode = (bits: BitReader) => bits.read(count);
  return { dsdl, maximumBits, encode, decode } satisfies Field<bigint>;
};

export const boolean = (cast: Cast = "saturated") => {
  const dsdl = `${cast} bool`;
  const maximumBits = 1;
  const encode = (bits: BitWriter, value: boolean) => bits.write(1, value);
  const decode = (bits: BitReader) => !!bits.read(1);
  return { dsdl, maximumBits, encode, decode } satisfies Field<boolean>;
};

export const float16 = (cast: Cast = "saturated") => {
  const dsdl = `${cast} float16`;
  const maximumBits = 16;
  const data = new Uint8Array(2);
  const view = new DataView(data.buffer);
  const encode = (bits: BitWriter, value: number) => {
    setFloat16(view, 0, value, true);
    bits.write(16, view.getUint16(0, true));
  };
  const decode = (bits: BitReader) => {
    view.setUint16(0, Number(bits.read(16)), true);
    return getFloat16(view, 0, true);
  };
  return { dsdl, maximumBits, encode, decode } satisfies Field<number>;
};

export const float32 = (cast: Cast = "saturated") => {
  const dsdl = `${cast} float32`;
  const maximumBits = 32;
  const data = new Uint8Array(4);
  const view = new DataView(data.buffer);
  const encode = (bits: BitWriter, value: number) => {
    view.setFloat32(0, value, true);
    bits.write(32, view.getUint32(0, true));
  };
  const decode = (bits: BitReader) => {
    view.setUint32(0, Number(bits.read(32)), true);
    return view.getFloat32(0, true);
  };
  return { dsdl, maximumBits, encode, decode } satisfies Field<number>;
};

export const float64 = (cast: Cast = "saturated") => {
  const dsdl = `${cast} float64`;
  const maximumBits = 64;
  const data = new Uint8Array(8);
  const view = new DataView(data.buffer);
  const encode = (bits: BitWriter, value: number) => {
    view.setFloat64(0, value, true);
    bits.write(64, view.getBigUint64(0));
  };
  const decode = (bits: BitReader) => {
    view.setBigUint64(0, bits.read(64), true);
    return view.getFloat64(0, true);
  };
  return { dsdl, maximumBits, encode, decode } satisfies Field<number>;
};

export const array = <T>(field: Field<T>, count: number) => {
  const dsdl = `${field.dsdl}[${count}]`;
  const maximumBits = field.maximumBits * count;
  const encode = (bits: BitWriter, value: T[]) =>
    range(0, count).forEach(i => field.encode(bits, assert(value[i])));
  const decode = (bits: BitReader) =>
    range(0, count).map(() => field.decode(bits));
  return { dsdl, maximumBits, encode, decode } satisfies Field<T[]>;
};

export const variableArray = <T>(field: Field<T>, max: number) => {
  const dsdl = `${field.dsdl}[<=${max}]`;
  const maximumBits = field.maximumBits * max;
  const tailArrayOptimizable = field.maximumBits >= 8;
  const size = Math.ceil(Math.log2(max + 1));
  const encode = (
    bits: BitWriter,
    value: T[],
    tailArrayOptimization?: "tao",
  ) => {
    const count = Math.min(value.length, max);
    if (!tailArrayOptimization || !tailArrayOptimizable)
      bits.write(size, count);
    range(0, count).forEach(i => field.encode(bits, assert(value[i])));
  };
  const decode = (bits: BitReader, tailArrayOptimization?: "tao") => {
    if (!tailArrayOptimization || !tailArrayOptimizable) {
      const count = Number(bits.read(size));
      return range(0, count).map(() => field.decode(bits));
    } else {
      const value: T[] = [];
      while (!bits.empty) value.push(field.decode(bits));
      return value;
    }
  };
  return { dsdl, maximumBits, encode, decode } satisfies Field<T[]>;
};

export const typeArray = <
  Type extends string,
  Definition extends TypeDefinition,
>(
  {
    type,
    definition,
    signature,
    maximumBits,
  }: MessageDefinition<Any, Type, Definition>,
  count: number,
) => {
  const dsdl = `${type}[${count}]`;
  maximumBits *= count;
  const encode = (bits: BitWriter, value: DefinitionType<Definition>[]) =>
    range(0, count).forEach(i =>
      encodeType(definition, bits, assert(value[i])),
    );
  const decode = (bits: BitReader) =>
    range(0, count).map(() => decodeType(definition, bits));
  return { dsdl, signature, maximumBits, encode, decode } satisfies Field<
    DefinitionType<Definition>[]
  >;
};

export const variableTypeArray = <
  Type extends string,
  Definition extends TypeDefinition,
>(
  {
    type,
    definition,
    signature,
    maximumBits,
  }: MessageDefinition<Any, Type, Definition>,
  max: number,
) => {
  const dsdl = `${type}[<=${max}]`;
  const tailArrayOptimizable = maximumBits >= 8;
  maximumBits *= max;
  const size = Math.ceil(Math.log2(max + 1));
  const encode = (
    bits: BitWriter,
    value: DefinitionType<Definition>[],
    tailArrayOptimization?: "tao",
  ) => {
    const count = Math.min(value.length, max);
    if (!tailArrayOptimization || !tailArrayOptimizable)
      bits.write(size, count);
    range(0, count).forEach(i =>
      encodeType(definition, bits, assert(value[i])),
    );
  };
  const decode = (bits: BitReader, tailArrayOptimization?: "tao") => {
    if (!tailArrayOptimization || !tailArrayOptimizable) {
      const count = Number(bits.read(size));
      return range(0, count).map(() => decodeType(definition, bits));
    } else {
      const value: DefinitionType<Definition>[] = [];
      while (!bits.empty) value.push(decodeType(definition, bits));
      return value;
    }
  };
  return { dsdl, signature, maximumBits, encode, decode } satisfies Field<
    DefinitionType<Definition>[]
  >;
};

export const byteArray = (count: number) => {
  const field = array(uint(8), count);
  const { dsdl, maximumBits } = field;
  const encode = (bits: BitWriter, value: Uint8Array) =>
    field.encode(bits, [...value]);
  const decode = (bits: BitReader) => new Uint8Array(field.decode(bits));
  return { dsdl, maximumBits, encode, decode } satisfies Field<Uint8Array>;
};

export const variableByteArray = (max: number) => {
  const field = variableArray(uint(8), max);
  const { dsdl, maximumBits } = field;
  const encode = (
    bits: BitWriter,
    value: Uint8Array,
    tailArrayOptimization?: "tao",
  ) => field.encode(bits, [...value], tailArrayOptimization);
  const decode = (bits: BitReader, tailArrayOptimization?: "tao") =>
    new Uint8Array(field.decode(bits, tailArrayOptimization));
  return { dsdl, maximumBits, encode, decode } satisfies Field<Uint8Array>;
};

export const string = (max: number) => {
  const field = variableByteArray(max);
  const { dsdl, maximumBits } = field;
  const encode = (
    bits: BitWriter,
    value: string,
    tailArrayOptimization?: "tao",
  ) =>
    field.encode(
      bits,
      new TextEncoder().encode(value.slice(0, max)),
      tailArrayOptimization,
    );
  const decode = (bits: BitReader, tailArrayOptimization?: "tao") =>
    new TextDecoder().decode(field.decode(bits, tailArrayOptimization));
  return { dsdl, maximumBits, encode, decode } satisfies Field<string>;
};

export const enumeration = <T>(count: number, options: readonly T[]) => {
  const field = uint(count);
  const { dsdl, maximumBits } = field;
  const encode = (bits: BitWriter, option: T) =>
    field.encode(bits, options.indexOf(option));
  const decode = (bits: BitReader) => assert(options[field.decode(bits)]);
  return {
    dsdl,
    maximumBits,
    encode,
    decode,
  } satisfies Field<T>;
};

export const flags = <T>(options: readonly T[]) => {
  const field = uint(options.length);
  const { dsdl, maximumBits } = field;
  const encode = (bits: BitWriter, value: T[]) =>
    field.encode(
      bits,
      value
        .map(_ => options.indexOf(_))
        .map(_ => 1 << _)
        .reduce((a, b) => a | b, 0),
    );
  const decode = (bits: BitReader) => {
    const value = field.decode(bits);
    return range(0, options.length).flatMap(_ =>
      value & (1 << _) ? [options[_]] : [],
    );
  };
  return { dsdl, maximumBits, encode, decode } as Field<T[]>;
};

export const mapped = <T, Values extends { [value: string]: T }>(
  field: Field<T>,
  values: Values,
) => {
  const { dsdl, maximumBits } = field;
  const encode = (bits: BitWriter, value: keyof Values | T) =>
    field.encode(
      bits,
      typeof value === "string" ? values[value] : (value as T),
    );
  const decode = (bits: BitReader) => {
    const value = field.decode(bits);
    return keys(values).find(_ => values[_] === value) ?? value;
  };
  return { dsdl, maximumBits, encode, decode } as Field<number | keyof Values>;
};

export const reference = <
  Type extends string,
  Definition extends TypeDefinition,
>({
  type,
  definition,
  signature,
  maximumBits,
}: MessageDefinition<Any, Type, Definition>) => {
  const dsdl = type;
  const encode = (
    bits: BitWriter,
    value: DefinitionType<Definition>,
    tailArrayOptimization?: "tao",
  ) => encodeType(definition, bits, value, tailArrayOptimization);
  const decode = (bits: BitReader, tailArrayOptimization?: "tao") =>
    decodeType(definition, bits, tailArrayOptimization);
  return {
    dsdl,
    maximumBits,
    signature,
    encode,
    decode,
  } satisfies Field<DefinitionType<Definition>>;
};
