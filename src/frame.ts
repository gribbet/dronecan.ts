import {
  bytesU32,
  createBitReader,
  createBitWriter,
  u32Bytes,
} from "./bits.js";

export type MessageFrame = {
  type: "message";
  source: number;
  id: number;
  priority?: number;
  other?: number;
};

export type AnonymousFrame = {
  type: "anonymous";
  source: number;
  id: number;
  discriminator: number;
  priority?: number;
  other?: number;
};

export type ServiceFrame = {
  type: "service";
  source: number;
  destination: number;
  request: boolean;
  id: number;
  priority?: number;
  other?: number;
};

export type Frame = MessageFrame | AnonymousFrame | ServiceFrame;

export const decodeFrame: (id: number) => Frame = id => {
  const bits = createBitReader(u32Bytes(id));
  const service = Boolean(bits.read(1));
  const source = Number(bits.read(7));
  if (service) {
    const request = Boolean(bits.read(1));
    const destination = Number(bits.read(7));
    const id = Number(bits.read(8));
    const other = Number(bits.read(3));
    const priority = Number(bits.read(5));
    return {
      type: "service",
      source,
      destination,
      request,
      id,
      priority,
      other,
    };
  } else if (source === 0) {
    const discriminator = Number(bits.read(14));
    const id = Number(bits.read(2));
    const other = Number(bits.read(3));
    const priority = Number(bits.read(5));
    return {
      type: "anonymous",
      source,
      id,
      discriminator,
      priority,
      other,
    };
  } else {
    const id = Number(bits.read(16));
    const other = Number(bits.read(3));
    const priority = Number(bits.read(5));
    return { type: "message", source, id, priority, other };
  }
};

export const encodeFrame: (frame: Frame) => number = frame => {
  const { type, source, priority, other } = frame;
  const service = type === "service";
  const bits = createBitWriter();
  bits.write(1, service);
  bits.write(7, source);
  if (service) {
    const { destination, request, id } = frame;
    bits.write(1, request);
    bits.write(7, destination);
    bits.write(8, id);
  } else if (type === "anonymous") {
    const { id, discriminator } = frame;
    bits.write(14, discriminator);
    bits.write(2, id);
  } else {
    const { id } = frame;
    bits.write(16, id);
  }
  bits.write(3, other ?? 4);
  bits.write(5, priority ?? 16);
  return bytesU32(bits.data);
};
