import { timeout } from './promise.ts';
import { afterSignal, promiseVoidForSignal } from './signal.ts';

export type WebSocketSupportedPayload = string | ArrayBufferLike | Blob | ArrayBufferView;
export type PrepMessage<T> = T | Promise<T> | (() => T | Promise<T>);

/**
 * Helper which returns a method that sends data over the given {@link WebSocket}, including queuing until it is connected.
 * This method returns `true` if the data was sent, or ever has a chance of being sent (i.e., not closed/closing).
 *
 * The passed message can be a `Promise`, or a function which returns a `Promise`.
 *
 * The data is sent without being transformed (i.e., no {@link JSON.stringify}), but you can pass this as the second arg if it's important to you.
 */
export function socketQueueSend<T = WebSocketSupportedPayload>(
  socket: WebSocket | Promise<WebSocket>,
  transformMessage?: (m: T) => WebSocketSupportedPayload | undefined,
): (message: PrepMessage<T>) => boolean {
  let p = Promise.resolve(socket);

  transformMessage ??= (m: T): WebSocketSupportedPayload | undefined =>
    m as WebSocketSupportedPayload | undefined;

  let resolvedSocket: WebSocket | undefined;

  const attemptSend = async (raw: PrepMessage<T>) => {
    if (resolvedSocket === undefined || resolvedSocket.readyState !== resolvedSocket.OPEN) {
      return;
    }

    let untransformed: T;
    if (typeof raw === 'function') {
      const fn = raw as () => T | Promise<T>;
      untransformed = await fn();
    } else {
      untransformed = await raw;
    }
    const transformed = transformMessage(untransformed);
    if (transformed != null) {
      resolvedSocket?.send(transformed);
    }
  };

  p = p.then(async (s) => {
    resolvedSocket = s;
    switch (s.readyState) {
      case s.CLOSED:
      case s.CLOSING:
      case s.OPEN:
        return s;
    }
    await new Promise<unknown>((resolve) => {
      s.addEventListener('open', resolve, { once: true });
      s.addEventListener('close', resolve, { once: true });
    });
    return s;
  });

  return (message: PrepMessage<T>) => {
    const maySend =
      resolvedSocket === undefined ||
      resolvedSocket.readyState === resolvedSocket.CONNECTING ||
      resolvedSocket.readyState === resolvedSocket.OPEN;
    if (maySend) {
      p = p.finally(() => attemptSend(message));
    }
    return maySend;
  };
}

export type SocketConnectArg = {
  /**
   * Signal that, if specified, closes the {@link WebSocket} when aborted.
   */
  signal?: AbortSignal;

  /**
   * The delay to wait for before opening the socket.
   */
  delay?: number;

  /**
   * Any protocols (second arg of {@link WebSocket} constructor).
   */
  protocols?: string | string[];

  /**
   * If specified, automatically added as the "message" handler.
   */
  message?: (e: MessageEvent) => void;
};

/**
 * Helper which prepares a {@link WebSocket} in a {@link Promise} that only resolves when it is ready.
 *
 * Additionally, accepts a {@link AbortSignal} which can be used to shut down the socket early.
 * This will cause the method to throw if already aborted.
 */
export async function socketConnect(url: string, opts?: SocketConnectArg): Promise<WebSocket> {
  if (opts?.delay) {
    const p = opts.signal ? promiseVoidForSignal(opts.signal) : undefined;
    await Promise.race([p, timeout(opts.delay)]);
  }
  opts?.signal?.throwIfAborted();

  const s = new WebSocket(url, opts?.protocols);
  if (opts?.signal) {
    afterSignal(opts?.signal, () => s.close());
  }

  if (opts?.message) {
    s.addEventListener('message', opts.message);
  }

  let wasOpen = false;

  return new Promise<WebSocket>((resolve, reject) => {
    s.addEventListener(
      'open',
      () => {
        wasOpen = true;
        resolve(s);
      },
      { once: true },
    );
    s.addEventListener('close', () => reject(new Error('WebSocket close')), { once: true });
    s.addEventListener(
      'error',
      () => {
        if (!wasOpen) {
          s.close(); // DON'T close socket already open (basically after our interaction is done)
        }
        reject(new Error('WebSocket error'));
      },
      { once: true },
    );
  });
}
