import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, type } from '../theme';
import { useTheme } from '../preferences';

type ConfirmOptions = {
  title: string;
  message?: string;
  /** Label of the affirmative button. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Paints the affirmative button in the negative colour and gives it a warning glyph. */
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
};

type Ctx = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ctx | null>(null);

/**
 * A themed replacement for `Alert.alert` confirmations. The platform alert is fine but
 * looks nothing like the rest of Sumry and does not exist at all on web, so every
 * destructive step goes through this instead.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<Ctx>((options) => {
    return new Promise<boolean>((resolve) => {
      // A second request while one is open answers the first as cancelled.
      resolver.current?.(false);
      resolver.current = resolve;
      setPending(options);
    });
  }, []);

  const answer = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setPending(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        visible={pending !== null}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => answer(false)}
      >
        {pending ? (
          <ConfirmCard
            options={pending}
            onCancel={() => answer(false)}
            onConfirm={() => answer(true)}
          />
        ) : null}
      </Modal>
    </ConfirmContext.Provider>
  );
}

function ConfirmCard({
  options,
  onCancel,
  onConfirm,
}: {
  options: ConfirmOptions;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(1, { damping: 20, stiffness: 260, mass: 0.7 });
  }, [progress]);

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  const card = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 18 },
      { scale: 0.96 + progress.value * 0.04 },
    ],
  }));

  const accent = options.destructive ? theme.negative : theme.accent;

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityLabel="Dismiss"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.card,
          card,
          { backgroundColor: theme.bgElevated, borderColor: theme.hairline },
        ]}
      >
        <View style={[styles.badge, { backgroundColor: withAlpha(accent) }]}>
          <Ionicons
            name={options.icon ?? (options.destructive ? 'trash-outline' : 'help-circle-outline')}
            size={22}
            color={accent}
          />
        </View>

        <Text style={[type.title, { color: theme.text, textAlign: 'center' }]}>
          {options.title}
        </Text>
        {options.message ? (
          <Text
            style={[
              type.body,
              { color: theme.textMuted, textAlign: 'center', lineHeight: 21 },
            ]}
          >
            {options.message}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: theme.keypad,
                borderColor: theme.hairline,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[type.label, { color: theme.text, fontSize: 15 }]}>
              {options.cancelLabel ?? 'Cancel'}
            </Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: options.destructive ? theme.negative : theme.text,
                borderColor: 'transparent',
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={[
                type.label,
                { color: options.destructive ? '#FFFFFF' : theme.bg, fontSize: 15 },
              ]}
            >
              {options.confirmLabel ?? (options.destructive ? 'Delete' : 'Confirm')}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

/** A faint wash of the accent, for the icon badge behind the glyph. */
function withAlpha(hex: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return 'rgba(127,127,127,0.14)';
  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, 0.16)`;
}

export function useConfirm(): Ctx {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}

/**
 * Runs a destructive action behind a confirmation, reporting the outcome. Keeps the
 * confirm/try/catch/toast dance out of every screen that deletes something.
 */
export function useDestructiveAction() {
  const confirm = useConfirm();
  return useCallback(
    async (
      options: ConfirmOptions,
      action: () => Promise<unknown>,
      handlers?: { onSuccess?: () => void; onError?: (message: string) => void },
    ) => {
      const ok = await confirm({ destructive: true, ...options });
      if (!ok) return false;
      try {
        await action();
        handlers?.onSuccess?.();
        return true;
      } catch (e) {
        handlers?.onError?.(e instanceof Error ? e.message : 'Unknown error');
        return false;
      }
    },
    [confirm],
  );
}

export type { ConfirmOptions };

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: 12 } },
      android: { elevation: 12 },
      default: { boxShadow: '0 16px 40px rgba(0,0,0,0.35)' as never },
    }),
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, alignSelf: 'stretch' },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md + 2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
