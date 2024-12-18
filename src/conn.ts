import type { WebSocket as NodeWebSocket } from 'ws';
import { promiseWithResolvers } from './promise.js';
import { buildEmptyListener, buildLinkQueue, Listener } from './queue.js';

/**
 * Simple abstract connection between two endpoints. Just sends messages between the endpoints,
 * does not do any request/response stuff.
 */
export type Conn<In = any, Out = any> = {
  /**
   * Listener for messages from the connection.
   */
  listener: Listener<In>;

  /**
   * Sends the message. Queues if not yet connected.
   */
  send(raw: Out): void;

  /**
   * Shutdown the connection. If cause is passed, an error is assumed.
   */
  close(cause?: any): void;

  /**
   * Aborts when this disconnects. Also look for `undefined` from `next()`.
   */
  signal: AbortSignal;

  /**
   * Done when socket closes. Throws on error, possibly with the `cause` via {@link Conn#close}.
   */
  done: Promise<void>;
};

/**
 * Builds an abstract {@link Conn} for the given socket, from Node or the browser.
 *
 * This sends and reads the packets encoded as JSON. This silently drops invalid JSON.
 *
 * The socket doesn't need to be open yet; if not, then sends are buffered until it is. There's no
 * signal passed here, and this will stay open until {@link Conn#close} is called.
 */
export function connForSocket<In, Out>(ws: WebSocket | NodeWebSocket): Conn<In, Out> {
  const c = new AbortController();
  ws.addEventListener('close', () => c.abort());

  if (ws.readyState === ws.CLOSED || ws.readyState === ws.CLOSING) {
    c.abort();
    return {
      listener: buildEmptyListener(),
      send() {},
      close() {},
      signal: c.signal,
      done: Promise.resolve(),
    };
  }

  const {
    promise: donePromise,
    resolve: doneResolve,
    reject: doneReject,
  } = promiseWithResolvers<void>();

  donePromise.finally(() => c.abort());

  // queue send events until we're open
  let sendQueue: undefined | any[];
  if (ws.readyState !== ws.OPEN) {
    const localSendQueue = [];
    sendQueue = localSendQueue;
    ws.addEventListener('open', () => {
      localSendQueue.forEach((q) => ws.send(q));
      localSendQueue.splice(0, localSendQueue.length); // clear to avoid refs
      sendQueue = undefined;
    });
  }

  const q = buildLinkQueue<In>();
  const conn: Conn = {
    listener: q.join(c.signal),

    send(raw) {
      if (sendQueue) {
        sendQueue.push(JSON.stringify(raw));
      } else {
        ws.send(JSON.stringify(raw));
      }
    },

    close(cause) {
      ws.close(cause ? 4000 : 1000, String(cause));
      cause && doneReject(cause);
    },

    signal: c.signal,

    done: donePromise,
  };

  const messageHandler = (data: string) => {
    let j: any;
    try {
      j = JSON.parse(data);
    } catch {
      return;
    }
    q.push(j);
  };

  if ('on' in ws) {
    ws.on('message', messageHandler);
    ws.on('error', (err) => doneReject(err));
    ws.on('close', () => doneResolve());
  } else {
    ws.addEventListener('message', (e) => messageHandler(e.data));
    ws.addEventListener('error', (e) => doneReject(e));
    ws.addEventListener('close', () => doneResolve());
  }

  return conn;
}
