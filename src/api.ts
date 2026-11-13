import Constants from 'expo-constants';
import { createApi } from './core';

/**
 * The phone binding of the shared Sumry client (src/core/api.ts, vendored from sumry/web).
 *
 * The base URL comes from EXPO_PUBLIC_API_URL so the same JS bundle can point at a local
 * backend during development and at the deployed one in a release build.
 */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'https://sumry.elyesghazel.ch';

export const api = createApi({ baseUrl: API_URL });
