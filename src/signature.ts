import { u64Bytes } from "./bits.js";
import { append, range } from "./util.js";

const mask = 0xffffffffffffffffn;
const poly = 0x42f0e1eba9ea3693n;

const crc = (data: Uint8Array, initial = 0n) =>
  [...data].reduce(
    (value, x) =>
      range(0, 8).reduce(
        value =>
          value & (1n << 63n) ? ((value << 1n) & mask) ^ poly : value << 1n,
        value ^ ((BigInt(x) << 56n) & mask),
      ),
    initial ^ mask,
  ) ^ mask;

export const dsdlSignature: (dsdl: string, signatures?: bigint[]) => bigint = (
  dsdl,
  signatures = [],
) => {
  const signature = crc(new TextEncoder().encode(dsdl));
  return signatures.reduce(
    (acc, signature) => crc(append(u64Bytes(signature), u64Bytes(acc)), acc),
    signature,
  );
};
