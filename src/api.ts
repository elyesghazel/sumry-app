import { createApi, type FetchLike } from './core';
import { DEFAULT_SERVER } from './lib/server';

/**
 * The phone binding of the shared Sumry client (src/core/api.ts, vendored from sumry/web).
 *
 * The server is chosen at runtime (sign-in screen, saved in SecureStore), so the client is
 * built with an empty base URL and the fetch below prefixes the current server on every
 * request. EXPO_PUBLIC_API_URL only provides the default.
 */
let server = DEFAULT_SERVER;

export function currentServer(): string {
  return server;
}

/** Points every following request at `next`. Callers handle session and cache cleanup. */
export function setServer(next: string): void {
  server = next;
}

const serverFetch: FetchLike = (path, init) =>
  (globalThis as unknown as { fetch: FetchLike }).fetch(server + path, init);

export const api = createApi({ baseUrl: '', fetch: serverFetch });
