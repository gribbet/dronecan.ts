import { u8Bytes, u16Bytes } from "./bits.js";
import { transferCrc } from "./crc.js";
import type { CanPayload } from "./dronecan.js";
import type { Frame } from "./frame.js";
import { encodeFrame } from "./frame.js";
import type { Tail } from "./tail.js";
import { encodeTail } from "./tail.js";
import { append, assert } from "./util.js";

export type Sender = {
  send: (frame: Frame, payload: Uint8Array) => void;
};

type State = {
  time: number;
  transferId: number;
};

export const createSender = (
  signatures: { [id: number]: bigint },
  write: (payload: CanPayload) => void,
) => {
  const states: { [id: number]: State } = {};

  const send = (
    frame: Frame,
    payload: Uint8Array,
    requestTransferId?: number,
  ) => {
    const id = encodeFrame(frame);

    let { time, transferId } = states[id] ?? {
      time: Date.now(),
      transferId: 0,
    };

    const expired = Date.now() - time > 2000;
    if (expired) transferId = 0;

    if (requestTransferId !== undefined) transferId = requestTransferId;

    if (payload.length <= 7) {
      const tail: Tail = {
        transferId,
        toggle: false,
        end: true,
        start: true,
      };

      const data = append(payload, u8Bytes(encodeTail(tail)));

      write({ id, data });
    } else {
      const signature = assert(signatures[frame.id]);
      const crc = transferCrc(signature, payload);

      payload = append(u16Bytes(crc), payload);

      let toggle = false;
      let start = true;
      while (payload.length > 0) {
        const end = payload.length <= 7;
        const tail: Tail = {
          transferId,
          toggle,
          end,
          start,
        };

        const data = append(payload.slice(0, 7), u8Bytes(encodeTail(tail)));
        write({ id, data });

        payload = payload.slice(7);
        toggle = !toggle;
        start = false;
      }
    }

    time = Date.now();
    const currentTransferId = transferId;
    transferId = (transferId + 1) % 32;
    states[id] = { time, transferId };

    return currentTransferId;
  };

  return { send } satisfies Sender;
};
