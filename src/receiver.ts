import { createBitReader } from "./bits";
import { transferCrc } from "./crc";
import type { CanPayload } from "./dronecan";
import type { Frame } from "./frame";
import { decodeFrame } from "./frame";
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
    transferId: number;
    toggle: boolean;
    timestamp: number;
  };

  const states: { [id: number]: State } = {};

  const read = ({ id, data }: CanPayload) => {
    const frame = decodeFrame(id);
    const tail = decodeTail(data[data.length - 1]!);

    const reset: State = {
      payload: new Uint8Array(),
      transferId: tail.transferId,
      toggle: false,
      timestamp: Date.now(),
    };
    let state = states[id] ?? reset;
    const expired = Date.now() - state.timestamp > 2000;
    if (
      expired ||
      tail.toggle !== state.toggle ||
      tail.transferId !== state.transferId
    ) {
      if (expired) console.log("Expired");
      if (tail.toggle !== state.toggle) console.log("Invalid toggle");
      if (tail.transferId !== state.transferId)
        console.log("Invalid transfer ID");
      state = reset;
    }

    states[id] = state;

    const payload = data.slice(0, data.length - 1);
    state.payload = append(state.payload, payload);
    state.toggle = !state.toggle;

    if (tail.end) {
      delete states[id];

      let { payload } = state;
      if (!tail.start) {
        const bits = createBitReader(payload);
        const crc = Number(bits.read(16));
        payload = bits.drain();
        const signature = signatures[frame.id];

        if (signature === undefined || crc !== transferCrc(signature, payload))
          return;
      }

      receive(frame, payload, state.transferId);
    }
  };

  return { read } satisfies Receiver;
};
