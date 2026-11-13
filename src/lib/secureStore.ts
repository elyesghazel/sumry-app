import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * The session token store: the keychain on the phone, localStorage in the web preview
 * (expo-secure-store has no web implementation, which made the web build unusable).
 */
const web = Platform.OS === 'web';

export const tokenStore = {
  get: (key: string): Promise<string | null> =>
    web ? Promise.resolve(globalThis.localStorage?.getItem(key) ?? null) : SecureStore.getItemAsync(key),
  set: (key: string, value: string): Promise<void> =>
    web ? Promise.resolve(globalThis.localStorage?.setItem(key, value)) : SecureStore.setItemAsync(key, value),
  remove: (key: string): Promise<void> =>
    web ? Promise.resolve(globalThis.localStorage?.removeItem(key)) : SecureStore.deleteItemAsync(key),
};
