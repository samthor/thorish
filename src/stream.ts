import { concatBytes } from '#support';
import type { Readable } from 'node:stream';

function toPayload(chunks: Uint8Array[]) {
  const out = concatBytes(chunks);
  const s = new TextDecoder().decode(out);
  return JSON.parse(s);
}

/**
 * Converts a node {@link Readable} or standard {@link ReadableStream}, which ends, to parsed JSON.
 */
export function readableToJson<T>(req: Readable | ReadableStream<Uint8Array>): Promise<T> {
  const chunks: Uint8Array[] = [];
  const dataHandler = (chunk: Uint8Array) => chunks.push(chunk);

  if ('on' in req) {
    req.on('data', dataHandler);

    return new Promise((resolve, reject) => {
      req.on('end', () => {
        try {
          resolve(toPayload(chunks));
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });
  }

  return (async () => {
    for await (const part of req) {
      chunks.push(part);
    }
    return toPayload(chunks);
  })();
}
