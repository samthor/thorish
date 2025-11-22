import { buildLimiter, type LimitConfig } from './limit.ts';
import { buildLinkQueue } from './queue.ts';
import { derivedSignal, promiseForSignal } from './signal.ts';
import { socketConnect } from './socket.ts';

const startSymbol = /* @__PURE__ */ Symbol('start') as any;

export type ActiveCall<In, Out> = {
  gen: AsyncGenerator<In, Error | void, void>;
  send(data: Out): void;
};

export type RemoteCall<Init = never> = {
  call<In = any, Out = any>(signal: AbortSignal): ActiveCall<In, Out>;
  init: Init;
  done: Promise<void>;
};

type HelloMessage<Init> = {
  ok: true;
  i: Init;
  l: { c?: LimitConfig; p?: LimitConfig };
};

type ControlMessage = {
  c?: number;
  stop?: string;
};

/**
 * Starts a connection to the remote URL.
 *
 * Notably this does not deal with r/c; it returns a {@link Promise} that resolves when ready.
 * Use the returned {@link RemoteCall} to call on _this active connection only_.
 *
 * Uses the protocol as implemented here: https://pkg.go.dev/github.com/samthor/thorgo/call
 */
export async function startRemoteCall<Init = never>(
  signal: AbortSignal,
  url: string,
): Promise<RemoteCall<Init>> {
  // simple socket connection
  const sock = await socketConnect(url, { signal });

  // faux internal signal wired to socket
  const internalController = derivedSignal(signal);
  sock.addEventListener('close', internalController.abort);

  // send hello, wait for handshake
  const helloPromise = new Promise<HelloMessage<Init>>((resolve, reject) => {
    sock.addEventListener(
      'message',
      (e) => {
        try {
          const p: HelloMessage<Init> = JSON.parse(e.data);
          if (!p.ok) {
            throw new Error('no ok');
          }
          resolve(p);
        } catch (e) {
          reject(e);
        }
      },
      { once: true },
    );
    sock.addEventListener('close', reject);
    signal.addEventListener('abort', reject);
    if (signal.aborted) {
      reject();
    }
  });
  sock.send(JSON.stringify({ p: '1' })); // protocol v=1
  const hello = await helloPromise;

  const callLimiter = buildLimiter(hello.l.c);
  const packetLimiter = buildLimiter(hello.l.p);

  // wiring for new calls
  let lastNewCall = 0;
  const activeCalls = new Map<number, (packet: { data?: any; error?: Error }) => void>();

  // prepare/add listener for incoming messages
  const listener = (() => {
    let activeInCall = 0;

    return (e: MessageEvent<string>) => {
      if (typeof e.data === 'string' && e.data[0] === ':') {
        // control message (id/stop)
        const control = safeJSONParse<ControlMessage>(e.data.substring(1));
        if (control?.c !== undefined) {
          activeInCall = control.c;
        }
        if (control?.stop !== undefined) {
          const active = activeCalls.get(activeInCall);
          active?.({ error: new RemoteCallError(control.stop) });
          activeCalls.delete(activeInCall);
        }
      } else {
        // regular message
        const data = safeJSONParse(e.data);
        if (data) {
          const active = activeCalls.get(activeInCall);
          active?.({ data });
        }
      }
    };
  })();
  sock.addEventListener('message', listener);

  const outboundQueue = buildLinkQueue<{ data?: any; stop?: string; c: number }>();
  const task = (async () => {
    const listener = outboundQueue.join(internalController.signal);
    let activeOutCall = 0;

    for (;;) {
      const next = await listener.next();
      if (!next) {
        return; // signal has died
      }

      if (next.stop !== undefined) {
        // don't wait, stop immediately
        const o: ControlMessage = { stop: next.stop };
        if (activeOutCall !== next.c) {
          o.c = next.c;
          activeOutCall = next.c;
        }
        sock.send(`:` + JSON.stringify(o));
        continue;
      }

      if (next.data === startSymbol) {
        await callLimiter(internalController.signal);
      } else {
        await packetLimiter(internalController.signal);
      }

      if (activeOutCall !== next.c) {
        sock.send(`:` + JSON.stringify({ c: next.c }));
        activeOutCall = next.c;
      }
      if (next.data !== startSymbol) {
        sock.send(JSON.stringify(next.data));
      }
    }
  })();

  // our task should never crash, but shutdown if we do
  task.catch((e) => internalController.abort(e));
  sock.addEventListener('error', (e) => internalController.abort(e));
  internalController.signal.addEventListener('abort', () => sock.close());

  const done = promiseForSignal(internalController.signal);
  done.then(() => {}); // don't have to consume this

  return {
    call<In, Out>(signal: AbortSignal) {
      if (signal.aborted) {
        // return zero/aborted
        return {
          send(data) {},
          gen: throwAsyncGenerator(signal.reason),
        };
      }

      const callId = ++lastNewCall;

      const q = buildLinkQueue<{ data?: In; error?: Error }>();
      activeCalls.set(callId, q.push.bind(q));
      const listener = q.join(signal);

      const gen = (async function* () {
        for (;;) {
          const next = await listener.next();
          if (next?.data) {
            yield next.data;
          }
          if (next?.error || next?.data === undefined) {
            return next?.error;
          }
        }
      })();

      outboundQueue.push({ data: startSymbol, c: callId });
      signal.addEventListener('abort', () => {
        activeCalls.delete(callId);
        outboundQueue.push({ stop: '', c: callId });
      });

      const send = (data: Out) => {
        if (!signal.aborted) {
          outboundQueue.push({ data, c: callId });
        }
      };
      return { send, gen };
    },
    init: hello.i,
    done,
  };
}

/**
 * Wraps a 'normal' shutdown from the remote end of a {@link RemoteCall} / {@link ActiveCall}.
 */
export class RemoteCallError extends Error {
  constructor(public readonly stop: string) {
    super(stop);
  }
}

function throwAsyncGenerator(reason: any) {
  return (async function* () {
    throw reason instanceof Error ? reason : new Error(reason);
  })();
}

function safeJSONParse<Type = any>(raw: string): Type | undefined {
  let out: Type;
  try {
    out = JSON.parse(raw);
  } catch {
    return;
  }
  return out;
}
