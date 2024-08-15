/**
 * Async map an object's entries to new values.
 */
export async function mapRecordAsync<I, O = I>(
  raw: Record<string, I>,
  cb: (name: string, value: I) => O | Promise<O>,
): Promise<Record<string, O>> {
  const inputEntries = Object.entries(raw);

  const outputEntriesPromise = inputEntries.map(async ([key, value]): Promise<[string, O]> => {
    const output = await cb(key, value);
    return [key, output];
  });
  const outputEntries = await Promise.all(outputEntriesPromise);

  return Object.fromEntries(outputEntries);
}

/**
 * Map an object's entries to new values.
 */
export function mapRecord<I, O = I>(
  raw: Record<string, I>,
  cb: (name: string, value: I) => O,
): Record<string, O> {
  const inputEntries = Object.entries(raw);

  const outputEntries = inputEntries.map(([key, value]): [string, O] => {
    const output = cb(key, value);
    return [key, output];
  });

  return Object.fromEntries(outputEntries);
}

/**
 * Filter a record by removing its nullable values (`undefined` and `null`), regardless of key.
 */
export function filterRecord<I>(raw: Record<string, I>): Record<string, NonNullable<I>>;

/**
 * Filter a record by applying a function to all its entries. Entries with truthy returns remain.
 */
export function filterRecord<I>(
  raw: Record<string, I>,
  cb?: (name: string, value: I) => unknown,
): Record<string, I>;

export function filterRecord<I>(
  raw: Record<string, I>,
  cb?: (name: string, value: I) => unknown,
): Record<string, I> {
  if (cb === undefined) {
    cb = (_, value) => value != null;
  }

  const inputEntries = Object.entries(raw);
  const outputEntries = inputEntries.filter(([key, value]): unknown => cb(key, value));
  return Object.fromEntries(outputEntries);
}
