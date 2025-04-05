import { timeout } from './promise.ts';
import { afterSignal, promiseVoidForSignal } from './signal.ts';

/**
 * Helper which returns a method that sends data over the given {@link WebSocket}, including queuing until it is connected.
 * This method returns `true` if the data was sent, or ever has a chance of being sent (i.e., not closed/closing).
 *
 * The data is sent without being transformed (i.e., no {@link JSON.stringify}), but you can pass this as the second arg if it's important to you.
 */
export function socketQueueSend(
  p: WebSocket | Promise<WebSocket>,
  transformMessage?: (m: any) => any,
): (message: any) => boolean {
  if (p instanceof WebSocket) {
    p = Promise.resolve(p);
  }

  transformMessage ??= (x) => x;

  let resolvedSocket: WebSocket | undefined;
  let queue: any[] | undefined = [];

  p.then((s) => {
    resolvedSocket = s;

    const clearQueue = () => {
      if (s.readyState === s.OPEN) {
        // queue only has already-transformed messages
        queue?.forEach((message) => s.send(message));
      }
      queue = undefined;
    };

    if (s.readyState !== s.CONNECTING) {
      // either connected or done; either way, flush queue now
      return clearQueue();
    }
    s.addEventListener('open', clearQueue, { once: true });
    s.addEventListener('close', clearQueue, { once: true });
    s.addEventListener('error', clearQueue, { once: true });
  });

  return (message: any) => {
    if (queue !== undefined) {
      queue.push(transformMessage(message));
    } else if (resolvedSocket && resolvedSocket?.readyState === resolvedSocket.OPEN) {
      resolvedSocket.send(transformMessage(message));
    } else {
      return false;
    }
    return true;
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
