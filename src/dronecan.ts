import type { Frame, ServiceFrame } from "./frame";
import { createReceiver } from "./receiver";
import { createSender } from "./sender";
import type {
  Message,
  MessageType,
  Schema,
  ServiceRequest,
  ServiceResponse,
  ServiceType,
} from "./specification";
import {
  collectSignatures,
  decodeMessage,
  decodeRequest,
  decodeResponse,
  encodeMessage,
  encodeRequest,
  encodeResponse,
  messageFromType,
  messageTypeFromId,
  serviceFromType,
  serviceTypeFromId,
} from "./specification";
import { createSubscriber } from "./subscriber";
import type { Any } from "./util";

export type Dronecan<S extends Schema> = {
  broadcast: <Type extends MessageType<S>>(
    type: Type,
    message: Message<S, Type>,
  ) => void;
  request: <Type extends ServiceType<S>>(
    type: Type,
    destination: number,
    request: ServiceRequest<S, Type>,
  ) => Promise<ServiceResponse<S, Type> | undefined>;
  onMessage: <Type extends MessageType<S>>(
    type: Type,
    handler: (message: ReceivedMessage<S, Type>) => void,
  ) => () => void;
  onRequest: <Type extends ServiceType<S>>(
    type: Type,
    handler: (request: ServiceRequest<S, Type>) => ServiceResponse<S, Type>,
  ) => () => void;
  destroy: () => void;
  nodeId: number;
};

export type CanPayload = {
  id: number;
  data: Uint8Array;
};

export type Can = {
  read: (handler: (data: CanPayload) => void) => () => void;
  write: (data: CanPayload) => void;
  destroy: () => void;
};

export type ReceivedMessage<S extends Schema, Type extends MessageType<S>> = {
  type: Type;
  source: number;
  message: Message<S, Type>;
};

export const createDronecan = <S extends Schema>(
  can: Can,
  schema: S,
  nodeId: number,
) => {
  const signatures = collectSignatures(schema);

  const messageSubscriber = createSubscriber<ReceivedMessage<S, Any>>();

  type ReceivedRequest<Type extends ServiceType<S>> = {
    frame: ServiceFrame;
    request: ServiceRequest<S, Type>;
    transferId: number;
  };
  const requestSubscriber = createSubscriber<ReceivedRequest<Any>>();

  type OpenRequest<Type extends ServiceType<S>> = {
    type: Type;
    destination: number;
    transferId: number;
    onComplete: (response: ServiceResponse<S, Type>) => void;
  };
  let requests: OpenRequest<Any>[] = [];

  const handleResponse = <Type extends ServiceType<S>>(
    type: Type,
    source: number,
    transferId: number,
    response: ServiceResponse<S, Type>,
  ) => {
    const onComplete = requests.find(
      _ =>
        _.type === type &&
        _.destination === source &&
        _.transferId === transferId,
    )?.onComplete;

    onComplete?.(response);

    requests = requests.filter(_ => _.onComplete !== onComplete);
  };

  const receiver = createReceiver(signatures, (frame, payload, transferId) => {
    const { type, source } = frame;
    switch (type) {
      case "message": {
        const type = messageTypeFromId(schema, frame.id);
        if (!type) return;
        const message = decodeMessage(schema, type, payload);
        messageSubscriber.emit({ type, source, message });
        return;
      }
      case "service": {
        const { request, source, destination } = frame;

        const type = serviceTypeFromId(schema, frame.id);

        if (!type || destination !== nodeId) return;

        if (request) {
          const request = decodeRequest(schema, type, payload);
          requestSubscriber.emit({ frame, request, transferId });
        } else {
          const response = decodeResponse(schema, type, payload);
          handleResponse(type, source, transferId, response);
        }
      }
    }
  });

  const sender = createSender(signatures, can.write);

  const destroy = can.read(receiver.read);

  const broadcast = <Type extends MessageType<S>>(
    type: Type,
    message: Message<S, Type>,
  ) => {
    const { id } = messageFromType(schema, type);
    if (id === undefined) return;
    const frame: Frame = {
      type: "message",
      source: nodeId,
      id,
    };
    const data = encodeMessage(schema, type, message);
    sender.send(frame, data);
  };

  const request = <Type extends ServiceType<S>>(
    type: Type,
    destination: number,
    request: ServiceRequest<S, Type>,
  ) => {
    const { id } = serviceFromType(schema, type);
    const frame: Frame = {
      type: "service",
      source: nodeId,
      destination,
      request: true,
      id,
    };
    const transferId = sender.send(frame, encodeRequest(schema, type, request));
    return new Promise<ServiceResponse<S, Type>>(onComplete => {
      const request: OpenRequest<Type> = {
        type,
        destination,
        transferId,
        onComplete,
      };
      requests.push(request);
    });
  };

  const onMessage = <Type extends MessageType<S>>(
    type: Type,
    handler: (message: ReceivedMessage<S, Type>) => void,
  ) =>
    messageSubscriber.subscribe(received => {
      if (type === received.type) handler(received as ReceivedMessage<S, Type>);
    });

  const onRequest = <Type extends ServiceType<S>>(
    _type: Type,
    handler: (Request: ServiceRequest<S, Type>) => ServiceResponse<S, Type>,
  ) =>
    requestSubscriber.subscribe(({ frame, request, transferId }) => {
      const type = serviceTypeFromId(schema, frame.id);
      if (type !== _type) return;
      const response = handler(request as ServiceRequest<S, Type>);
      frame = {
        ...frame,
        source: nodeId,
        destination: frame.source,
        request: false,
      };
      sender.send(frame, encodeResponse(schema, type, response), transferId);
    });

  return {
    broadcast,
    request,
    onMessage,
    onRequest,
    destroy,
    nodeId,
  } satisfies Dronecan<S>;
};
