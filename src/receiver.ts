import { createBitReader } from "./bits";
import { transferCrc } from "./crc";
import type { CanPayload } from "./dronecan";
import type { Frame } from "./frame";
import { decodeFrame } from "./frame";
import type { Tail } from "./tail";
import { decodeTail } from "./tail";
import { append } from "./util";

export type Receiver = {
  read: (payload: CanPayload) => void;
};

export const createReceiver = (
  signatures: { [id: number]: bigint },
  receive: (frame: Frame, payload: Uint8Array, transferId: number) => void,
) => {
  type State = {
    payload: Uint8Array;
    toggle: boolean;
    timestamp: number;
  };

  const states: { [key: number]: State } = {};

  const transferKey = (frame: Frame, { transferId }: Tail) => {
    const destination = "destination" in frame ? frame.destination : 0;
    const discriminator = "discriminator" in frame ? frame.discriminator : 0;
    const source = frame.source || discriminator;
    const request = ("request" in frame ? frame.request : false) ? 1 : 0;
    const { id } = frame;
    return (
      (id << 20) |
      (source << 13) |
      (destination << 6) |
      (request << 5) |
      transferId
    );
  };

  const read = ({ id, data }: CanPayload) => {
    const frame = decodeFrame(id);
    const tail = decodeTail(data[data.length - 1]!);
    const { transferId } = tail;

    const key = transferKey(frame, tail);

    const reset: State = {
      payload: new Uint8Array(),
      toggle: tail.toggle,
      timestamp: Date.now(),
    };
    let state = states[key] ?? reset;
    const expired = Date.now() - state.timestamp > 2000;
    if (expired || tail.toggle !== state.toggle) {
      if (expired) console.log("Expired");
      if (tail.toggle !== state.toggle) console.log("Invalid toggle");
      state = reset;
    }

    states[key] = state;

    const payload = data.slice(0, data.length - 1);
    state.payload = append(state.payload, payload);
    state.toggle = !state.toggle;

    if (tail.end) {
      delete states[key];

      let { payload } = state;
      if (!tail.start) {
        const bits = createBitReader(payload);
        const crc = Number(bits.read(16));
        payload = bits.drain();
        const signature = signatures[frame.id];

        if (
          signature === undefined ||
          crc !== transferCrc(signature, payload)
        ) {
          if (signature !== undefined) console.log("Invalid CRC");
          return;
        }
      }

      receive(frame, payload, transferId);
    }
  };

  return { read } satisfies Receiver;
};
