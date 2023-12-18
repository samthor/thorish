/**
 * This exists entirely so the constructor of {@link Proxy} below realizes it's proxying a
 * function-like-object. It is not called.
 */
function neverFunctionForProxy() {
  throw new Error(`should not get here`);
}

/**
 * Builds a fake version of a passed module-like that allows bound callables (functions, classes).
 *
 * This can be used like `const { foo } = mocked;`, where `foo` is a function on `mocked`. Updates
 * to `mocked.foo` later are _still reflected_ in `foo`, because it's secretly a `Proxy`.
 *
 * The original passed module remains unchanged.
 */
export function buildBoundProxy<T extends Record<string | symbol, any>>(mod: T): T {
  const fakeModule: Record<string | symbol, any> = {};
  const functionRef: Record<string | symbol, Function> = {};

  for (const key of Reflect.ownKeys(mod)) {
    if (typeof mod[key] !== 'function') {
      fakeModule[key] = mod[key];
      continue;
    }
    functionRef[key] = mod[key];

    // Uses Reflect to implement Proxy, but use 'current value' and not the original target.
    // This is a Proxy pointing _to_ Reflect, which means it "supports all operations", but at
    // the dynamic target.
    const currentValueReflect = new Proxy(Reflect, {
      get(_reflect, reflectKey) {
        return (...args: any[]) => (Reflect as any)[reflectKey](functionRef[key], ...args.slice(1));
      },
    });
    fakeModule[key] = new Proxy(neverFunctionForProxy, currentValueReflect);
  }

  const setValue = (property: string | symbol, value: any): boolean => {
    if (property in functionRef) {
      if (fakeModule[property] === value) {
        // we're being passed back the initial Proxy (i.e., `fake.fn = fake.fn`), treat as noop
        // it's still *easy* to break this fake, but this is a simple detectable case
        return true;
      } else if (typeof value !== 'function') {
        throw new Error(`can't redefine function => primitive for ${String(property)}`);
      }
      functionRef[property] = value;
      return true;
    } else if (property in fakeModule) {
      // this allows setting function on previously primitive types, whatever
      fakeModule[property] = value;
      return true;
    }
    // can't define new properties
    return false;
  };

  return new Proxy(
    {},
    {
      ownKeys(_target) {
        return Reflect.ownKeys(fakeModule);
      },

      set(_target, property, value) {
        return setValue(property, value);
      },

      get(_target, property) {
        return fakeModule[property];
      },

      getOwnPropertyDescriptor(_target, property) {
        const target = property in functionRef ? functionRef : fakeModule;
        return Reflect.getOwnPropertyDescriptor(target, property);
      },

      defineProperty(_target, property, attributes) {
        // This only allows `defineProperty` with a value. But `getOwnPropertyDescriptor` will also
        // only expose value, so if a spy library is doing the get => modify => set dance, it'll
        // likely re-use value.
        if (attributes.get || attributes.set) {
          throw new Error(`can't defineProperty with get/set on fake module`);
        } else if (!('value' in attributes)) {
          return false;
        }
        return setValue(property, attributes.value);
      },
    },
  ) as T;
}
