import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  Fraunces_300Light,
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_500Medium_Italic,
} from '@expo-google-fonts/fraunces';
import { AppProvider, useApp } from '../src/store';
import { PreferencesProvider, useTheme } from '../src/preferences';
import { Screen } from '../src/components/Screen';
import { LockGate } from '../src/components/LockGate';
import { ToastProvider } from '../src/components/Toast';
import { ConfirmProvider } from '../src/components/ConfirmDialog';

/**
 * Keeps the visible route in step with the session: an expired token drops you on the
 * sign-in screen, and signing in returns you to the tabs.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthRoute = segments[0] === 'sign-in';

    if (status === 'signed-out' && !inAuthRoute) router.replace('/sign-in');
    else if (status === 'signed-in' && inAuthRoute) router.replace('/');
  }, [status, segments, router]);

  if (status === 'loading') return <Splash />;
  return <>{children}</>;
}

function Splash() {
  const theme = useTheme();
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.textMuted} />
      </View>
    </Screen>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Fraunces_300Light,
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_500Medium_Italic,
  });

  // Holding the first frame avoids a visible reflow from the system face to the real ones.
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PreferencesProvider>
          {/* Toasts and confirmations sit above every route, so they wrap the navigator. */}
          <ToastProvider>
            <ConfirmProvider>
              <AppProvider>
                <AuthGate>
                  <LockGate>
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: 'transparent' },
                      }}
                    >
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen name="sign-in" />
                      <Stack.Screen
                        name="entry"
                        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                      />
                      <Stack.Screen name="settings/categories" />
                      <Stack.Screen name="settings/category" options={{ presentation: 'modal' }} />
                      <Stack.Screen name="settings/password" options={{ presentation: 'modal' }} />
                      <Stack.Screen name="settings/insights" />
                      <Stack.Screen name="settings/index" />
                      <Stack.Screen name="budgets" />
                      <Stack.Screen name="account/[id]" />
                      <Stack.Screen name="pot/[id]" />
                      <Stack.Screen name="category/[label]" />
                      <Stack.Screen name="planned/[id]" />
                      <Stack.Screen name="safe" />
                      <Stack.Screen name="statement" />
                      <Stack.Screen name="import" options={{ presentation: 'modal' }} />
                    </Stack>
                  </LockGate>
                </AuthGate>
              </AppProvider>
            </ConfirmProvider>
          </ToastProvider>
        </PreferencesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
