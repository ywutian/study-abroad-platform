/**
 * A value that has been through JSON.stringify/parse has no Dates left — every
 * DateTime is an ISO string. Declaring the round-trip this way makes the
 * compiler refuse `cached.updatedAt.toISOString()` instead of letting it throw
 * at runtime on a cache hit.
 */
export type MaybeSerialized<T> = T extends Date
  ? Date | string
  : T extends (infer U)[]
    ? MaybeSerialized<U>[]
    : T extends object
      ? { [K in keyof T]: MaybeSerialized<T[K]> }
      : T;
