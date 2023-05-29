
// @ts-ignore tsc on command-line is unhappy
import { base64ToBytes as supportBase64ToBytes } from '#support';

/**
 * Convert a base64-encoded string to a {@link Uint8Array}. In Node, this returns a {@link Buffer}
 * which is a subclass.
 */
export function base64ToBytes(s: string): Uint8Array {
  return supportBase64ToBytes(s);
}
