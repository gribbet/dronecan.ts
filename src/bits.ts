const valueBit = (i: number, count: number): number => {
  const base = i & ~7;
  const len = Math.min(8, count - base);
  return base + (len - 1 - (i - base));
};

export const readBits = (data: Uint8Array, offset: number, count: number) => {
  if (count < 0 || count > 64) throw new Error("invalid");
  if (count === 0) return 0n;

  let result = 0n;
  for (let i = 0; i < count; i++) {
    const dataBit = offset + i;
    const byte = dataBit >>> 3;
    const byteBit = 7 - (dataBit & 7);
    const bit = ((data[byte] ?? 0) >>> byteBit) & 1;
    result |= BigInt(bit) << BigInt(valueBit(i, count));
  }
  return result;
};

export const writeBits = (
  data: Uint8Array,
  offset: number,
  count: number,
  value: bigint,
) => {
  if (count < 0 || count > 64) throw new Error("invalid");
  if (count === 0) return;

  for (let i = 0; i < count; i++) {
    const dataBit = offset + i;
    const byte = dataBit >>> 3;
    const byteBit = 7 - (dataBit & 7);
    const bitValue = Number((value >> BigInt(valueBit(i, count))) & 1n);

    data[byte] = ((data[byte] ?? 0) & ~(1 << byteBit)) | (bitValue << byteBit);
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
