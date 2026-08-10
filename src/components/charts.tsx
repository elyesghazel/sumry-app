import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '../preferences';
import { radius, space, type } from '../theme';
import { formatAmount } from '../format';

/**
 * Charts are drawn with thin marks, recessive axes and selective labelling: a value on
 * every point is noise, so only the extremes and the touched mark are called out.
 */

// ---------------------------------------------------------------- bar series

export type BarDatum = { key: string; label: string; value: number };

/**
 * Spending per bucket. A bar chart rather than a line because each bucket is a discrete
 * total, not a reading of a continuous quantity.
 */
export function BarSeries({
  data,
  color,
  height = 120,
  currency,
}: {
  data: BarDatum[];
  color: string;
  height?: number;
  currency: string;
}) {
  const theme = useTheme();
  const [active, setActive] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.value), 1);
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  // Too many bars to label individually — show first, peak and last only.
  const labelled = new Set([0, peak, data.length - 1]);
  const shown = active ?? peak;
  const showable = data[shown];

  return (
    <View>
      <View style={styles.readout}>
        <Text style={[type.amount, { color: theme.text }]}>
          {formatAmount(showable?.value ?? 0)}{' '}
          <Text style={[type.caption, { color: theme.textFaint }]}>{currency}</Text>
        </Text>
        <Text style={[type.caption, { color: theme.textFaint }]}>
          {active === null ? `peak · ${showable?.label ?? ''}` : showable?.label}
        </Text>
      </View>

      <View style={[styles.barRow, { height }]}>
        {data.map((d, i) => {
          const isActive = i === shown;
          return (
            <Pressable
              key={d.key}
              onPressIn={() => setActive(i)}
              onPressOut={() => setActive(null)}
              // Hit target spans the full height so thin bars stay tappable.
              style={styles.barSlot}
              accessibilityLabel={`${d.label}: ${formatAmount(d.value)} ${currency}`}
            >
              <View style={styles.barTrack}>
                <View
                  style={{
                    height: `${Math.max(d.value > 0 ? 2 : 0, (d.value / max) * 100)}%`,
                    backgroundColor: isActive ? theme.text : color,
                    opacity: d.value === 0 ? 0.25 : isActive ? 1 : 0.85,
                    // Rounded data-end anchored to the baseline.
                    borderTopLeftRadius: 3,
                    borderTopRightRadius: 3,
                    width: '100%',
                  }}
                />
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.axis, { borderTopColor: theme.grid }]}>
        {data.map((d, i) => (
          <View key={d.key} style={styles.barSlot}>
            {labelled.has(i) ? (
              <Text style={[type.caption, { color: theme.textFaint }]} numberOfLines={1}>
                {d.label}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------- sparkline

/** A filled trend line, for the shape of a series rather than its exact values. */
export function Sparkline({
  values,
  color,
  height = 56,
}: {
  values: number[];
  color: string;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (values.length < 2 || width === 0) {
    return <View style={{ height }} onLayout={onLayout} />;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * height;
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width.toFixed(1)},${height} L0,${height} Z`;

  return (
    <View onLayout={onLayout} style={{ height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#sparkFill)" />
        <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

// ------------------------------------------------------------- ranked bars

export type RankedDatum = { label: string; value: number; share: number; color: string; meta?: string };

/**
 * Ranked horizontal bars for a categorical breakdown — directly labelled, which reads
 * more accurately than a donut and doubles as the secondary encoding the palette needs.
 */
export function RankedBars({
  data,
  currency,
  onPress,
}: {
  data: RankedDatum[];
  currency: string;
  onPress?: (label: string) => void;
}) {
  const theme = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={{ gap: space.md }}>
      {data.map((d) => (
        <Pressable
          key={d.label}
          onPress={onPress ? () => onPress(d.label) : undefined}
          accessibilityLabel={`${d.label}: ${formatAmount(d.value)} ${currency}, ${Math.round(d.share * 100)} percent`}
        >
          <View style={styles.rankHead}>
            <View style={styles.rankLabel}>
              <View style={[styles.swatch, { backgroundColor: d.color }]} />
              <Text style={[type.body, { color: theme.text, flexShrink: 1 }]} numberOfLines={1}>
                {d.label}
              </Text>
            </View>
            <Text style={[type.amount, { color: theme.text, fontSize: 15 }]}>
              {formatAmount(d.value)}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: theme.keypad }]}>
            <View
              style={{
                width: `${Math.max(1.5, d.share * 100)}%`,
                height: '100%',
                backgroundColor: d.color,
                borderRadius: radius.pill,
              }}
            />
          </View>
          <Text style={[type.caption, { color: theme.textFaint, marginTop: 4 }]}>
            {Math.round(d.share * 100)}%{d.meta ? ` · ${d.meta}` : ''}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ------------------------------------------------------- paired month columns

export type MonthDatum = { key: string; label: string; income: number; expense: number };

/**
 * Income and expense side by side per month. Both series share one axis because they
 * share a unit — a second scale would make the comparison a lie.
 */
export function MonthColumns({ data, height = 130 }: { data: MonthDatum[]; height?: number }) {
  const theme = useTheme();
  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);

  return (
    <View>
      <View style={styles.legend}>
        <LegendKey color={theme.positive} label="In" />
        <LegendKey color={theme.negative} label="Out" />
      </View>

      <View style={[styles.barRow, { height }]}>
        {data.map((d) => (
          <View key={d.key} style={styles.barSlot}>
            <View style={styles.pairRow}>
              <View style={styles.pairTrack}>
                <View
                  style={{
                    height: `${Math.max(d.income > 0 ? 2 : 0, (d.income / max) * 100)}%`,
                    backgroundColor: theme.positive,
                    borderTopLeftRadius: 3,
                    borderTopRightRadius: 3,
                  }}
                />
              </View>
              <View style={styles.pairTrack}>
                <View
                  style={{
                    height: `${Math.max(d.expense > 0 ? 2 : 0, (d.expense / max) * 100)}%`,
                    backgroundColor: theme.negative,
                    borderTopLeftRadius: 3,
                    borderTopRightRadius: 3,
                  }}
                />
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.axis, { borderTopColor: theme.grid }]}>
        {data.map((d) => (
          <View key={d.key} style={styles.barSlot}>
            <Text style={[type.caption, { color: theme.textFaint }]} numberOfLines={1}>
              {d.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.legendKey}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={[type.caption, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.md,
  },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  barTrack: { width: '100%', height: '100%', justifyContent: 'flex-end' },
  pairRow: { flexDirection: 'row', gap: 2, height: '100%', width: '100%', alignItems: 'flex-end' },
  pairTrack: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  axis: {
    flexDirection: 'row',
    gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.xs,
    marginTop: space.xs,
  },
  rankHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
    gap: space.md,
  },
  rankLabel: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  legend: { flexDirection: 'row', gap: space.lg, marginBottom: space.md },
  legendKey: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
