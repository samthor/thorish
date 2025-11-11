/**
 * Configuration for {@link buildLimiter}.
 */
export type LimitConfig = {
  /**
   * Maximum and initial total of tokens in this limiter.
   *
   * This must be `>=1` to be valid.
   */
  b: number;

  /**
   * Rate of renewal of tokens, per second.
   *
   * This must be `>0` to be valid.
   */
  r: number;
};

/**
 * Fetches a {@link Promise} which resolves when a token is available.
 *
 * Throws if the {@link AbortSignal} is or becomes aborted before a token is available.
 */
export type Limiter = (signal: AbortSignal) => Promise<void>;

/**
 * Builds a rate-limiter which can be called to consume a token.
 *
 * Throws if the config is invalid (cowardly refuses to make an invalid limiter).
 * Without a passed config, uses a default of 100 tokens, renews at 10/sec.
 */
export function buildLimiter(c?: LimitConfig): Limiter {
  const maxTokens = (c?.b ?? 100.0) * 1.0;
  const rateOfIncrease = (c?.r ?? 10) * 1.0;

  if (maxTokens <= 0 || rateOfIncrease <= 0) {
    throw new Error(`invalid LimitConfig, no requests allowed`);
  }

  let last = performance.now();
  let tokens = maxTokens;

  return async (signal: AbortSignal): Promise<void> => {
    for (;;) {
      signal.throwIfAborted();

      const now = performance.now();
      const delta = (now - last) / 1000.0;
      const increase = delta * rateOfIncrease;
      tokens = Math.min(maxTokens, tokens + increase);
      last = now;
      const secondsToWait = (1.0 - tokens) / rateOfIncrease;

      if (secondsToWait <= 0.0) {
        tokens -= 1.0;
        return; // success
      }

      await new Promise<void>((r) => {
        const timeout = setTimeout(r, secondsToWait * 1000.0);
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          r();
        });
      });
    }
  };
}

const PERSISTENT_DELAY_EXP = 1.65;
const PERSISTENT_DELAY_BASE = 230;
const PERSISTENT_DELAY_MAX = 60_000;
const PERSISTENT_DELAY_RAND = 0.1;

export interface Backoff {
  readonly delay: number;

  /**
   * Delays by this long.
   * Abandons (but does not throw) if the signal aborts.
   */
  timeout(signal?: AbortSignal): Promise<void>;

  /**
   * Indicate that we've been successful.
   * Resets the delay.
   */
  success(): void;

  /**
   * Indicate that an error has occured here.
   * Increases the delay.
   */
  error(): void;
}

/**
 * Creates a simple backoff helper.
 */
export function createBackoff(baseDelay?: number): Backoff {
  baseDelay ||= 0;
  let extraDelay = 0;
  let nextDelay = 0;

  return {
    get delay() {
      return nextDelay;
    },
    async timeout(signal) {
      if (signal?.aborted) {
        return;
      }
      return new Promise((r) => {
        setTimeout(r, nextDelay);
        signal?.addEventListener('abort', () => r(), { once: true });
      });
    },
    success() {
      extraDelay = 0;
      nextDelay = 0;
    },
    error() {
      extraDelay = (extraDelay + PERSISTENT_DELAY_BASE) * PERSISTENT_DELAY_EXP;
      extraDelay = Math.min(extraDelay, PERSISTENT_DELAY_MAX);

      const factor = 1.0 - (Math.random() * PERSISTENT_DELAY_RAND * 2 - PERSISTENT_DELAY_RAND);
      const delay = (baseDelay + extraDelay) * factor;
      nextDelay = Math.max(0, delay);
    },
  };
}
