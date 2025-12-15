import type { BitReader, BitWriter } from "./bits";
import { createBitReader, createBitWriter } from "./bits";
import type { Field } from "./field";
import { union } from "./field";
import type { Any } from "./util";
import { assert, camelToSnakeCase, keys } from "./util";

type Union = {
  [union]: readonly [];
};

export type TypeDefinition = Partial<Union> & { [key: string]: Field<Any> };

type UnionDefinitionType<T> = {
  [K in keyof Omit<T, typeof union>]?: T[K] extends Field<infer U> ? U : never;
};
type StandardDefinitionType<T> = {
  [K in keyof T]: T[K] extends Field<infer U> ? U : never;
};
export type DefinitionType<T> = T extends Union
  ? UnionDefinitionType<T>
  : StandardDefinitionType<T>;

const fields = <T extends TypeDefinition>(definition: T) =>
  keys(definition).filter((_): _ is keyof Omit<T, typeof union> => _ !== union);

export const decodeType = <T extends TypeDefinition>(
  definition: T,
  bits: BitReader,
  tailArrayOptimization?: "tao",
) =>
  (union in definition
    ? decodeUnionType(definition, bits)
    : decodeStandardType(
        definition,
        bits,
        tailArrayOptimization,
      )) as DefinitionType<T>;

const decodeUnionType = <T extends TypeDefinition>(
  definition: T,
  bits: BitReader,
) => {
  const count = fields(definition).length;
  const size = Math.ceil(Math.log2(count + 1));
  const index = Number(bits.read(size));

  const field = assert(fields(definition)[index]);
  const value = definition[field].decode(bits);

  return { [field]: value } as UnionDefinitionType<T>;
};

const decodeStandardType = <T extends TypeDefinition>(
  definition: T,
  bits: BitReader,
  tailArrayOptimization?: "tao",
) =>
  fields(definition).reduce(
    (acc, field, i) => (
      (acc[field] = assert(definition[field]).decode(
        bits,
        i === fields(definition).length - 1 ? tailArrayOptimization : undefined,
      )),
      acc
    ),
    {} as StandardDefinitionType<T>,
  );

export const encodeType = <T extends TypeDefinition>(
  definition: T,
  bits: BitWriter,
  value: DefinitionType<T>,
  tailArrayOptimization?: "tao",
) =>
  union in definition
    ? encodeUnionType(definition, bits, value)
    : encodeStandardType(
        definition,
        bits,
        value as StandardDefinitionType<T>,
        tailArrayOptimization,
      );

const encodeUnionType = <T extends TypeDefinition>(
  definition: T,
  bits: BitWriter,
  value: UnionDefinitionType<T>,
) => {
  const count = fields(definition).length;
  const size = Math.ceil(Math.log2(count + 1));
  const field = assert(
    fields(definition).find(
      _ => keys(value).includes(_) && value[_] !== undefined,
    ),
  );
  const index = fields(definition).indexOf(field);
  bits.write(size, index);
  definition[field].encode(bits, value[field]);
};

const encodeStandardType = <T extends TypeDefinition>(
  definition: T,
  bits: BitWriter,
  value: StandardDefinitionType<T>,
  tailArrayOptimization?: "tao",
) =>
  fields(definition).forEach((field, i) =>
    assert(definition[field]).encode(
      bits,
      value[field],
      i === fields(definition).length - 1 ? tailArrayOptimization : undefined,
    ),
  );

export const decoded = <T extends TypeDefinition>(
  definition: T,
  data: Uint8Array,
) => decodeType(definition, createBitReader(data, true), "tao");

export const encoded = <T extends TypeDefinition>(
  definition: T,
  value: DefinitionType<T>,
) => {
  const bits = createBitWriter(true);
  encodeType(definition, bits, value, "tao");
  return bits.data;
};

export const definitionDsdl = <T extends TypeDefinition>(
  definition: T,
  preserveFieldNames = false,
) =>
  [
    ...(union in definition ? ["@union"] : []),
    ...fields(definition).map(key => {
      const { dsdl } = assert(definition[key]);
      const fieldName = preserveFieldNames
        ? String(key)
        : camelToSnakeCase(String(key));
      return dsdl.startsWith("void") ? dsdl : `${dsdl} ${fieldName}`;
    }),
  ].join("\n");
