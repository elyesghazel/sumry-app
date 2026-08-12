import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, type } from '../theme';
import { useTheme } from '../preferences';

export type ToastTone = 'success' | 'error' | 'info';

type ToastOptions = {
  message: string;
  /** Second line, for the detail that would otherwise bloat the message. */
  description?: string;
  tone?: ToastTone;
  /** Overrides the tone's default glyph. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Milliseconds on screen. */
  duration?: number;
};

type ToastItem = Required<Pick<ToastOptions, 'message' | 'tone' | 'duration'>> &
  Omit<ToastOptions, 'message' | 'tone' | 'duration'> & { id: number };

type Ctx = {
  show: (options: ToastOptions) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
};

const ToastContext = createContext<Ctx | null>(null);

/** Only ever a few on screen; older ones are dropped rather than queued. */
const MAX_VISIBLE = 3;

const TONE_ICON: Record<ToastTone, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

/**
 * App-wide transient feedback. Toasts float above every route, so this provider sits
 * near the root and renders its own overlay layer rather than anything route-owned.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const item: ToastItem = {
      id: nextId.current++,
      tone: options.tone ?? 'info',
      duration: options.duration ?? 2600,
      message: options.message,
      description: options.description,
      icon: options.icon,
    };
    setItems((current) => [...current, item].slice(-MAX_VISIBLE));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      show,
      success: (message, description) => show({ message, description, tone: 'success' }),
      error: (message, description) =>
        show({ message, description, tone: 'error', duration: 3800 }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        style={[styles.layer, { paddingBottom: insets.bottom + space.xxl + space.lg }]}
        pointerEvents="box-none"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  const accent =
    item.tone === 'success' ? theme.positive : item.tone === 'error' ? theme.negative : theme.accent;

  useEffect(() => {
    progress.value = withSpring(1, { damping: 18, stiffness: 220, mass: 0.6 });
    const timer = setTimeout(() => {
      progress.value = withTiming(0, { duration: 180 }, (finished) => {
        if (finished) runOnJS(onDismiss)();
      });
    }, item.duration);
    return () => clearTimeout(timer);
    // The card is remounted per toast, so this runs once per toast.
  }, [item.duration, onDismiss, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 24 },
      { scale: 0.94 + progress.value * 0.06 },
    ],
  }));

  return (
    <Animated.View style={animated}>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={`${item.message}. Dismiss`}
        style={[
          styles.card,
          {
            backgroundColor: theme.bgElevated,
            borderColor: theme.hairline,
            shadowColor: '#000',
          },
        ]}
      >
        <View style={[styles.rail, { backgroundColor: accent }]} />
        <Ionicons name={item.icon ?? TONE_ICON[item.tone]} size={18} color={accent} />
        <View style={{ flex: 1 }}>
          <Text style={[type.body, { color: theme.text }]} numberOfLines={2}>
            {item.message}
          </Text>
          {item.description ? (
            <Text
              style={[type.label, { color: theme.textFaint, marginTop: 2 }]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingLeft: space.lg,
    paddingRight: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    // Toasts sit over content, so they need to detach from it visually.
    ...Platform.select({
      ios: { shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 6 },
      default: { boxShadow: '0 8px 24px rgba(0,0,0,0.22)' as never },
    }),
  },
  rail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
});
