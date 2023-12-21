import { createBitReader, createBitWriter, u8Bytes } from "./bits";
import { assert } from "./util";

export type Tail = {
  transferId: number;
  toggle: boolean;
  end: boolean;
  start: boolean;
};

export const decodeTail: (tail: number) => Tail = tail => {
  const bits = createBitReader(u8Bytes(tail));
  const start = !!bits.read(1);
  const end = !!bits.read(1);
  const toggle = !!bits.read(1);
  const transferId = Number(bits.read(5));
  return { transferId, toggle, end, start };
};

export const encodeTail: (tail: Tail) => number = ({
  transferId,
  toggle,
  end,
  start,
}) => {
  const bits = createBitWriter();
  bits.write(1, start ? 1 : 0);
  bits.write(1, end ? 1 : 0);
  bits.write(1, toggle ? 1 : 0);
  bits.write(5, transferId);
  const [value] = bits.data;
  return assert(value);
};
