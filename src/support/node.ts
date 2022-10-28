
export { isDeepStrictEqual as isArrayEqualIsh } from 'node:util';

// Node 16 doesn't have DOMException
export const DOMException = global.DOMException ? global.DOMException : class DOMException extends Error {
  name: string;

  constructor(message?: string, name?: string) {
    super(message);
    this.name = name === undefined ? 'Error' : String(name);
  }
};
