import { soloListener } from './listener.ts';
import { objectNotifyAll, objectWait } from './notify.ts';
import { buildLinkQueue } from './queue.ts';

export type CallToken = Object;

export type MuxTask<Out> = { token: CallToken } & ({ signal: AbortSignal } | { data: Out });

type InternalMuxTask<In, Out> =
  | { token: CallToken } & (
      | { signal: AbortSignal; respond: (x: SimpleResponse<In>) => void }
      | { data: Out }
    );

export interface MuxSession<In, Out> {
  signal: AbortSignal;

  /**
   * Should this session be kept alive?
   * This might be useful to check during setup or if {@link nextTask} returns nothing.
   */
  keepAlive(): boolean;

  /**
   * Synchronously return the next task.
   * This may return `undefined` even if the session is still active, check {@link hasActive}.
   */
  nextTask(): MuxTask<Out> | undefined;

  /**
   * Wait for another task to become ready.
   */
  waitForTask(): Promise<true>;

  /**
   * Process a message received for this {@link CallToken}.
   */
  handle(token: CallToken, data: In): void;

  /**
   * Process a remote shutdown of this {@link CallToken}.
   */
  stop(token: CallToken, error?: Error): void;
}

export type MuxFn<In, Out> = (session: MuxSession<In, Out>) => Promise<any>;

type SimpleResponse<X> = { data?: X; error?: Error };

class MuxSessionImpl<In, Out> implements MuxSession<In, Out> {
  readonly controller = new AbortController();
  public readonly signal = this.controller.signal;

  readonly active = new Map<CallToken, (x: SimpleResponse<In>) => void>();

  constructor(private readonly tasks: Set<InternalMuxTask<In, Out>>) {}

  keepAlive(): boolean {
    return this.active.size !== 0 || this.tasks.size !== 0;
  }

  nextTask(): MuxTask<Out> | undefined {
    let t: InternalMuxTask<In, Out> | undefined;
    for (const x of this.tasks) {
      t = x;
      this.tasks.delete(x);
      break;
    }
    if (t === undefined) {
      return;
    }

    if ('respond' in t) {
      if (t.signal.aborted) {
        return this.nextTask();
      }
      t.signal.addEventListener('abort', () => this.active.delete(t.token));
      this.active.set(t.token, t.respond);
      return { token: t.token, signal: t.signal };
    } else if (!this.active.has(t.token)) {
      // silently drop messages for already-dead calls
      return this.nextTask();
    }

    return t;
  }

  async waitForTask(): Promise<true> {
    while (!this.tasks.size) {
      await objectWait(this.tasks);
    }
    return true;
  }

  handle(token: CallToken, data: In): void {
    const fn = this.active.get(token);
    fn?.({ data });
  }

  stop(token: CallToken, error?: Error): void {
    const fn = this.active.get(token);
    fn?.({ error });
    this.active.delete(token);
  }
}

export interface Call<In, Out> {
  /**
   * Listen to data from the other side.
   */
  readonly gen: AsyncGenerator<In, Error | void, void>;

  /**
   * Send the packet.
   * This may queue the packet rather than send immediately.
   */
  send(data: Out): void;
}

export type MuxCall<In, Out> = {
  call(signal: AbortSignal): Call<In, Out>;
  addListener(cb: (error: Error) => void, signal: AbortSignal): void;
};

/**
 * Builds a {@link MuxCall}.
 */
export function buildMux<In, Out>(runner: MuxFn<In, Out>): MuxCall<In, Out> {
  let activeRunner: Promise<any> | undefined;
  const tasks = new Set<InternalMuxTask<In, Out>>();

  const listener = soloListener<Error>();

  const maybeStartRunner = () => {
    if (!tasks.size || activeRunner !== undefined) {
      return;
    }

    const session = new MuxSessionImpl(tasks);
    const response: { error?: Error } = {};

    activeRunner = runner(session)
      .catch((error) => {
        response.error = error;
        listener.dispatch(error);
      })
      .finally(() => {
        activeRunner = undefined;
        maybeStartRunner();

        // kill all still-active because the runner shut down
        session.active.forEach((cb) => cb(response));
      });
  };

  const call = (signal: AbortSignal): Call<In, Out> => {
    if (signal.aborted) {
      const gen = (async function* () {
        try {
          signal.throwIfAborted();
        } catch (e: any) {
          return e instanceof Error ? e : new Error(e);
        }
      })();
      return { send() {}, gen };
    }

    const queue = buildLinkQueue<SimpleResponse<In>>();
    const listener = queue.join(signal);

    const gen = (async function* () {
      for (;;) {
        const m = await listener.next();
        if (m?.data !== undefined) {
          yield m?.data as In;
        }
        if (m?.error || m?.data === undefined) {
          return m?.error as Error | void;
        }
      }
    })();

    // something object-like
    const token: CallToken = new Object();
    const setupTask = { token, signal, respond: queue.push.bind(queue) };
    tasks.add(setupTask);
    objectNotifyAll(tasks);

    signal.addEventListener('abort', () => {
      if (tasks.delete(setupTask)) {
        objectNotifyAll(tasks);
      }
    });

    const send = (out: Out) => {
      if (!signal.aborted) {
        tasks.add({ token, data: out });
        objectNotifyAll(tasks);
      }
    };

    maybeStartRunner();

    return { gen, send };
  };

  return { call, addListener: listener.addListener };
}
