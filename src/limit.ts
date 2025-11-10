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
