/**
 * Checks the given condition by re-running the passed function many times.
 * Useful for tests.
 *
 * Called many times within the given {@link ms} period, default `2000` ms.
 */
export async function checkCond<T>(
  check: () => T,
  ms = defaultCheckCondTimeout,
): Promise<Awaited<T>> {
  const target = performance.now() + ms;

  for (;;) {
    const remain = target - performance.now();
    if (remain <= 0) {
      return await check();
    }

    const delay = Math.max(0, Math.pow(remain, 0.65));
    await new Promise((r) => setTimeout(r, delay));

    try {
      return await check();
    } catch {}
  }
}

export const defaultCheckCondTimeout = 2_000;
