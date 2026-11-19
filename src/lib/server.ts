import Constants from 'expo-constants';
import { tokenStore } from './secureStore';

/**
 * Which Sumry server the app talks to. One build works against any self-hosted instance:
 * the user picks the server on the sign-in screen, EXPO_PUBLIC_API_URL only sets the default.
 */

const SERVER_KEY = 'sumry.server';

export const DEFAULT_SERVER: string = stripServer(
  process.env.EXPO_PUBLIC_API_URL ??
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
    'https://sumry.elyesghazel.ch',
);

/** Trailing slashes and a trailing `/api` go, the API client adds the paths itself. */
function stripServer(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\/api$/i, '').replace(/\/+$/, '');
}

/**
 * Turns user input into a server origin, or throws a readable error.
 * `sumry.example.ch` becomes `https://sumry.example.ch`. Plain http is only accepted in
 * development builds, where the backend usually runs on the LAN.
 */
export function normalizeServer(input: string): string {
  let raw = input.trim();
  if (!raw) throw new Error('Enter a server address');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
  const url = stripServer(raw);
  const m = /^(https?):\/\/([^/?#\s]+)(\/[^?#\s]*)?$/i.exec(url);
  if (!m) throw new Error('That does not look like a server address');
  if (m[1].toLowerCase() !== 'https' && !__DEV__) throw new Error('The server must use https');
  return `${m[1].toLowerCase()}://${m[2].toLowerCase()}${m[3] ?? ''}`;
}

async function ok(url: string, timeoutMs: number): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolves when the address answers like a Sumry backend, throws otherwise. */
export async function checkServer(server: string, timeoutMs = 8000): Promise<void> {
  if (await ok(`${server}/actuator/health`, timeoutMs)) return;
  if (await ok(`${server}/api/config`, timeoutMs)) return;
  throw new Error(`No Sumry server answered at ${server.replace(/^https?:\/\//, '')}`);
}

export const serverStore = {
  /** A session saved before the server field existed has no entry: that means the default. */
  get: async (): Promise<string> => {
    const stored = await tokenStore.get(SERVER_KEY).catch(() => null);
    return stored ? stripServer(stored) : DEFAULT_SERVER;
  },
  set: (server: string): Promise<void> => tokenStore.set(SERVER_KEY, server),
};
