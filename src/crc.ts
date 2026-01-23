import { u64Bytes } from "./bits.js";
import { append, range } from "./util.js";

export const transferCrc = (signature: bigint, payload: Uint8Array) =>
  crc16(append(u64Bytes(signature), payload));

const crc16 = (data: Uint8Array) =>
  [...data].reduce(
    (value, x) =>
      range(0, 8).reduce(
        value =>
          value & 0x8000 ? ((value << 1) & 0xffff) ^ 0x1021 : value << 1,
        value ^ (x << 8),
      ),
    0xffff,
  );
