import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../src/store';
import { Screen } from '../src/components/Screen';
import { useTheme } from '../src/theme';

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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <AuthGate>
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
            </Stack>
          </AuthGate>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
