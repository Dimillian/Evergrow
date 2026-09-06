/** Native structured cloning avoids a JSON encode/decode round trip for staged transactions. */
export const cloneData = (globalThis as unknown as { structuredClone<T>(value: T): T }).structuredClone;
