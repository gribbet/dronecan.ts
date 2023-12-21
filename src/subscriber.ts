export type Subscriber<T> = {
  subscribe: (handler: (value: T) => void) => () => void;
  emit: (value: T) => void;
};

export const createSubscriber: <T>() => Subscriber<T> = <T>() => {
  type Handler = (value: T) => void;
  let handlers: Handler[] = [];

  const subscribe = (handler: Handler) => {
    handlers = [handler, ...handlers];
    return () => {
      handlers = handlers.filter(_ => _ !== handler);
    };
  };

  const emit = (value: T) => handlers.forEach(handler => handler(value));

  return {
    subscribe,
    emit,
  };
};
