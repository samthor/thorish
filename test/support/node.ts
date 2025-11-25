import { checkCond, defaultCheckCondTimeout } from '../../src/check.ts';

/**
 * Tries different ways to trigger the Node.JS GC.
 */
export async function forceNodeGC() {
  try {
    // @ts-ignore
    global.gc();
    return;
  } catch {}

  try {
    const { setFlagsFromString } = await import('v8');
    const { runInNewContext } = await import('vm');

    setFlagsFromString('--expose_gc');
    const gc = runInNewContext('gc');
    gc();
  } catch (e) {
    console.info('Could not force Node GC', e);
  }
}

/**
 * Checks the given condition while also forcing the GC to run.
 */
export async function checkGC(check: () => void, ms = defaultCheckCondTimeout) {
  return checkCond(async () => {
    await forceNodeGC();
    check();
  }, ms);
}
