/**
 * Returns the passed `Record` with only the specified extra keys made required, all others are
 * allowed to be `undefined`.
 */
export type RequiredValues<X extends Record<string | symbol, any>, K extends keyof X> = {
  [P in K]: X[P];
} & {
  [P in Exclude<keyof X, K>]: X[P] | undefined;
};

/**
 * Prepares/builds an object and callback which is `useEffect`-like.
 *
 * The returned object is actually a `Proxy`, and when values are changed, the callback is
 * invoked synchronously (as part of the set).
 *
 * This limits updates to those where the `required` fields are defined (second arg of `build`).
 * The second `build()` layer is to allow TypeScript to infer types.
 */
export function prepareEffectTrigger<X extends Record<string | symbol, any>>(): {
  // nb. Needs this extra step because we can't provide X and not K
  build<K extends keyof X>(
    cb: (signal: AbortSignal, values: RequiredValues<X, K>) => any,
    required?: K[],
  ): Partial<X>;
} {
  const build = <K extends keyof X>(cb, required) => {
    const requiredSet = new Set<K>(required ?? []);
    const have = new Set<string | symbol>();

    let abort = (reason: any) => {};

    const o: Record<string | symbol, any> = {};
    const maybeTrigger = () => {
      abort('trigger');
      if (have.size !== requiredSet.size) {
        return;
      }

      const c = new AbortController();
      abort = (reason) => c.abort(reason);
      cb(c.signal, { ...o });
    };

    const p = new Proxy(o, {
      deleteProperty(_, key) {
        delete o[key];
        if (requiredSet.has(key as K)) {
          have.delete(key);
        }
        maybeTrigger();
        return true;
      },

      set(_, key, value) {
        if (requiredSet.has(key as K)) {
          if (value !== undefined) {
            have.add(key);
          } else {
            have.delete(key);
          }
        }

        const prev = o[key];
        o[key] = value; // set in case this 'creates' undefined
        if (prev !== value) {
          maybeTrigger();
        }
        return true;
      },
    });

    return p as X;
  };
  return { build };
}
