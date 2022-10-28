
import { isDeepStrictEqual } from 'node:util';
export { isDeepStrictEqual, isDeepStrictEqual as isArrayEqualIsh };

export const DOMException = global.DOMException ? global.DOMException : class DOMException extends Error {
  name: string;

  constructor(message?: string, name?: string) {
    super(message);
    this.name = name === undefined ? 'Error' : String(name);
  }
};