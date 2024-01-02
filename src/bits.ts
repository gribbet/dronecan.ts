const readBits: (data: Uint8Array, offset: number, count: number) => bigint = (
  data,
  offset,
  count,
) => {
  if (count < 0 || count > 64) throw new Error("invalid");
  if (count === 0) return 0n;

  let result = 0n;

  let i = 0;
  while (i < count) {
    const start = (offset + i) % 8;
    const n = Math.min(count - i, 8 - start);
    const end = start + n;
    const index = Math.floor((i + offset) / 8);
    const byte = data[index] ?? 0;
    const bitOffset = Math.max(0, 8 - end);
    const mask = ((1 << n) - 1) << bitOffset;
    const bits = (byte & mask) >> bitOffset;
    result |= BigInt(bits) << BigInt(i);
    i += n;
  }

  return result;
};

const writeBits: (
  data: Uint8Array,
  offset: number,
  count: number,
  value: bigint,
) => void = (data, offset, count, value) => {
  if (count < 0 || count > 64) throw new Error("invalid");
  if (count === 0) return 0n;

  let i = 0;
  while (i < count) {
    const start = (offset + i) % 8;
    const n = Math.min(count - i, 8 - start);
    const end = start + n;
    const index = Math.floor((i + offset) / 8);
    const byte = data[index] ?? 0;
    const writeMask = (1n << BigInt(n)) - 1n;
    const bits = Number((value >> BigInt(i)) & writeMask);
    const bitOffset = Math.max(0, 8 - end);
    const mask = ((1 << n) - 1) << bitOffset;
    data[index] = (byte & ~mask) | ((bits << bitOffset) & mask);
    i += n;
  }
};

const padTo = (data: Uint8Array, count: number) => {
  const padding = count - data.length;
  if (padding <= 0) return data;
  const padded = new Uint8Array(count);
  padded.set(data);
  return padded;
};

export const u8Bytes: (value: number) => Uint8Array = value =>
  new Uint8Array([value]);

export const u16Bytes: (value: number) => Uint8Array = value => {
  const data = new Uint8Array(2);
  const view = new DataView(data.buffer);
  view.setUint16(0, value, true);
  return data;
};

export const u32Bytes: (value: number) => Uint8Array = value => {
  const data = new Uint8Array(4);
  const view = new DataView(data.buffer);
  view.setUint32(0, value, true);
  return data;
};

export const u64Bytes: (value: bigint) => Uint8Array = value => {
  const data = new Uint8Array(8);
  const view = new DataView(data.buffer);
  view.setBigUint64(0, value, true);
  return data;
};

export const bytesU8: (_data: Uint8Array) => number = _data => {
  const data = padTo(_data, 1);
  const view = new DataView(data.buffer);
  return view.getUint8(0);
};

export const bytesU32: (_data: Uint8Array) => number = _data => {
  const data = padTo(_data, 4);
  const view = new DataView(data.buffer);
  return view.getUint32(0, true);
};

export type BitReader = {
  read(count: number): bigint;
  drain(): Uint8Array;
  empty: boolean;
};

export const createBitReader: (data: Uint8Array) => BitReader = data => {
  let offset = 0;

  const read = (count: number) => {
    const result = readBits(data, offset, count);
    offset += count;
    return result;
  };

  const drain = () => {
    const result = data.slice(offset / 8);
    offset = data.length * 8;
    return result;
  };

  return {
    read,
    drain,
    get empty() {
      return offset >= data.length * 8;
    },
  };
};

export type BitWriter = {
  write(count: number, value: bigint | number | boolean): void;
  data: Uint8Array;
};

export const createBitWriter: () => BitWriter = () => {
  let data = new Uint8Array();
  let offset = 0;

  const write = (count: number, value: bigint | number | boolean) => {
    data = padTo(data, Math.ceil((offset + count) / 8) + 8);
    writeBits(data, offset, count, BigInt(value));
    offset += count;
  };

  return {
    write,
    get data() {
      return data.slice(0, Math.ceil(offset / 8));
    },
  };
};
