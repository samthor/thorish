type SignalFunc = (signal: AbortSignal) => void | Promise<void>;

type HaltFunc = (signal: AbortSignal, resume: AbortSignal) => void | Promise<void>;

/**
 * Manages a group of signals to create a unified signal that has the super lifecycle of all of them.
 */
export class CGroup {
  private shutdownCause: any = undefined;
  private controller?: AbortController;
  private active: number = 0;
  private tasks: SignalFunc[] = [];
  private readonly halts: HaltFunc[] = [];

  private resumeController?: AbortController;
  private resumeStart?: (hf: HaltFunc) => void;

  /**
   * Adds a signal to this group.
   * Returns `true` if the signal was not already aborted and was added to the active set.
   */
  public add(signal: AbortSignal): boolean {
    if (signal.aborted || this.controller?.signal.aborted) {
      return false;
    }

    ++this.active;

    signal.addEventListener('abort', () => {
      --this.active;
      if (this.active < 0) {
        throw new Error('cgroup active went -ve');
      } else if (this.active > 0 || !this.controller) {
        return;
      }
      if (this.resumeController) {
        throw new Error('cgroup abort with resumeController');
      }

      // Don't run microtask if we can abort immediately (no halt tasks).
      if (this.halts.length === 0) {
        this.controller.abort();
        return;
      }

      this.resumeController = new AbortController();
      const resumeSignal = this.resumeController.signal;

      let haltActive = 0;
      this.resumeStart = async (halt: HaltFunc) => {
        ++haltActive;
        try {
          await halt(this.controller!.signal, resumeSignal);
        } catch (err) {
          this.shutdownCause ??= err;
          this.controller!.abort(err);
        }

        --haltActive;
        if (haltActive === 0 && this.resumeController?.signal === resumeSignal) {
          this.controller!.abort();
        }
      };

      this.halts.forEach(this.resumeStart);
    });

    // If a shutdown was in progress, adding a new signal cancels it.
    if (this.controller && this.resumeController) {
      this.resumeController.abort();
      this.resumeController = undefined;
      this.resumeStart = undefined;
    }

    return !this.controller?.signal.aborted;
  }

  /**
   * Starts the group and returns its {@link AbortSignal}.
   * If no valid signals were added, this will be immediately aborted.
   */
  public start(): AbortSignal {
    if (!this.controller) {
      this.controller = new AbortController();
      if (this.active === 0) {
        this.controller.abort();
      } else {
        this.tasks.forEach((fn) => this.runTask(fn));
        this.tasks = []; // Clear tasks after starting
      }
    }
    return this.controller.signal;
  }

  /**
   * Ensures the group has started, then waits until the group's signal is aborted.
   */
  public async wait(): Promise<void> {
    const signal = this.start();

    const buildPromise = () => {
      if (this.shutdownCause !== undefined) {
        return Promise.reject(this.shutdownCause);
      } else {
        return Promise.resolve();
      }
    };

    if (signal.aborted) {
      return buildPromise();
    }
    return new Promise((resolve) => {
      signal.addEventListener('abort', () => resolve(buildPromise()), { once: true });
    });
  }

  /**
   * Runs the given function as part of this group.
   * It will only start after `start()` has been called.
   * Any returned error will cancel the group's signal.
   */
  public go(fn: SignalFunc): boolean {
    if (!this.controller) {
      this.tasks.push(fn);
      return true;
    }

    if (this.controller.signal.aborted) {
      return false;
    }

    this.runTask(fn);
    return true;
  }

  /**
   * Registers a function to run when the group is about to shut down.
   * It is passed the group's signal and a "resume" signal which is aborted if the group restarts.
   * Any returned error will cancel the group's signal.
   */
  public halt(fn: HaltFunc): boolean {
    if (this.controller?.signal.aborted) {
      return false;
    }

    // If we are already in the shutdown phase, start the halt function immediately.
    this.resumeStart?.(fn);

    this.halts.push(fn);
    return true;
  }

  /**
   * Helper to execute a task and handle its potential error.
   */
  private async runTask(fn: SignalFunc) {
    try {
      await fn(this.controller!.signal);
    } catch (err) {
      this.shutdownCause ??= err;
      this.controller!.abort(err);
    }
  }
}
