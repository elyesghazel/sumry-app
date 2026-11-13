import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { Screen } from '../src/components/Screen';
import { CategoryPicker } from '../src/components/CategoryPicker';
import { Btn, Card, Divider, Header, Hint, KV, Pills, Section } from '../src/components/ui';
import { useToast } from '../src/components/Toast';
import { useConfirm } from '../src/components/ConfirmDialog';
import { useApp } from '../src/store';
import { formatAmount, maskIbansIn, type ImportPreview, type ImportRow } from '../src/core';
import { api } from '../src/api';
import { MAX_UPLOAD_BYTES, kindOf, readBase64, readText } from '../src/lib/files';
import { shortDay } from '../src/lib/dates';
import { usePreferences, useTheme } from '../src/preferences';
import { radius, space, type } from '../src/theme';

const TYPES = ['application/pdf', 'text/csv', 'text/comma-separated-values', 'application/xml', 'text/xml', 'text/plain'];

/** A warning that carries the backend's redacted diagnostics rather than a one-liner. */
const isDiagnostics = (w: string) => w.includes('\n') || /diagnos/i.test(w);

/**
 * Statement import: pick a PDF, camt.053 XML or CSV, see what would be booked (duplicates
 * greyed, missing categories highlighted, every category editable), book it, and line the
 * balance up with the statement's closing balance if they differ.
 */
export default function Import() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ account?: string }>();
  const { accounts, token, mutate } = useApp();
  const { prefs, tick, mask } = usePreferences();
  const toast = useToast();
  const confirm = useConfirm();

  const [accountId, setAccountId] = useState<string | null>(params.account ?? prefs.defaultAccountId ?? accounts[0]?.id ?? null);
  const [file, setFile] = useState<{ name: string; size?: number } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [rows, setRows] = useState<(ImportRow & { include: boolean })[]>([]);
  const [busy, setBusy] = useState<null | 'reading' | 'booking'>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const account = accounts.find((a) => a.id === accountId);
  const included = rows.filter((r) => r.include);
  const missing = included.filter((r) => !r.categoryLabel && r.kind !== 'TRANSFER_IN' && r.kind !== 'TRANSFER_OUT').length;
  const sum = included.reduce((s, r) => s + (r.kind === 'INCOME' || r.kind === 'TRANSFER_IN' ? r.amount : -r.amount), 0);

  const pick = async () => {
    if (!token || !accountId) return;
    setError(null);
    tick();
    const res = await DocumentPicker.getDocumentAsync({ type: TYPES, copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    if (asset.size && asset.size > MAX_UPLOAD_BYTES) {
      setError(`${asset.name} is ${(asset.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`);
      return;
    }
    setFile({ name: asset.name, size: asset.size });
    setPreview(null);
    setRows([]);
    setBusy('reading');
    try {
      const kind = kindOf(asset);
      const input =
        kind === 'csv'
          ? { accountId, csv: await readText(asset), fileName: asset.name }
          : { accountId, fileBase64: await readBase64(asset), fileName: asset.name };
      const p = await api.importPreview(token, input);
      setPreview(p);
      setRows(p.rows.map((r) => ({ ...r, include: !r.duplicate })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the statement');
    } finally {
      setBusy(null);
    }
  };

  const commit = async () => {
    if (!token || !accountId || !preview || !included.length) return;
    setBusy('booking');
    try {
      const res = await mutate((t) =>
        api.importCommit(t, {
          accountId,
          rows: included.map((r) => ({
            line: r.line,
            date: r.date,
            description: r.description,
            amount: r.amount,
            kind: r.kind,
            categoryLabel: r.categoryLabel,
          })),
        }),
      );
      toast.success(`Booked ${res.booked} ${res.booked === 1 ? 'entry' : 'entries'}`, res.skipped.length ? `${res.skipped.length} skipped` : file?.name);
      const closing = preview.statementClosingBalance;
      if (closing !== null && closing !== undefined) {
        const fresh = (await api.accounts(token)).find((a) => a.id === accountId);
        const diff = fresh ? closing - fresh.currentBalance : 0;
        if (fresh && Math.abs(diff) >= 0.005) {
          const ok = await confirm({
            title: 'Line up the balance?',
            message: `The statement closes at ${formatAmount(closing)}, Sumry shows ${formatAmount(fresh.currentBalance)} for ${fresh.accountName}. Book the ${diff > 0 ? '+' : '−'}${formatAmount(diff)} difference as an "Einstellung" entry?`,
            confirmLabel: 'Reconcile',
            icon: 'git-compare-outline',
          });
          if (ok) {
            await mutate((t) => api.reconcileAccount(t, accountId, closing, 'Abgleich Kontoauszug'));
            toast.success('Balance lined up', `${fresh.accountName} · ${formatAmount(closing)}`);
          }
        }
      }
      setPreview(null);
      setRows([]);
      setFile(null);
      router.replace({ pathname: '/activity', params: { account: accountId } });
    } catch (e) {
      toast.error('Could not book', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  const warnings = preview?.warnings ?? [];
  const diagnostics = warnings.filter(isDiagnostics);
  const plain = warnings.filter((w) => !isDiagnostics(w));
  const editingRow = editing !== null ? rows[editing] : null;

  return (
    <Screen>
      <Header title="Import statement" subtitle="PDF, camt.053 XML or CSV" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <Section title="Into account" />
        <View style={{ paddingHorizontal: space.lg }}>
          <Pills
            items={accounts.map((a) => ({ key: a.id, label: a.accountName }))}
            selected={accountId}
            onSelect={(k) => {
              setAccountId(k);
              setPreview(null);
              setRows([]);
            }}
          />
        </View>

        <Card style={{ marginTop: space.lg }}>
          <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.sm }}>
            <Ionicons name="document-text-outline" size={30} color={theme.textMuted} />
            <Text style={[type.label, { color: theme.text }]}>{file ? file.name : 'PostFinance PDF, camt.053 or a CSV export'}</Text>
            {file?.size ? <Text style={[type.caption, { color: theme.textFaint }]}>{Math.round(file.size / 1024)} KB</Text> : null}
            {busy === 'reading' ? (
              <ActivityIndicator color={theme.textMuted} />
            ) : (
              <Btn primary icon="folder-open-outline" label={file ? 'Pick another file' : 'Pick a file'} disabled={!accountId} onPress={pick} />
            )}
          </View>
        </Card>
        <Hint text="Nothing is booked until you confirm. IBANs in descriptions arrive masked. Up to 10 MB." />

        {error ? (
          <Card style={{ marginTop: space.lg, borderColor: theme.negative }}>
            <Text style={[type.label, { color: theme.negative }]}>{error}</Text>
          </Card>
        ) : null}

        {preview ? (
          <>
            <Section title="Statement" detail={preview.format} />
            <Card>
              {preview.statementFrom || preview.statementTo ? (
                <KV label="Period" value={`${preview.statementFrom ? shortDay(preview.statementFrom) : '?'} – ${preview.statementTo ? shortDay(preview.statementTo) : '?'}`} />
              ) : null}
              {preview.statementOpeningBalance != null ? <KV label="Opening balance" value={mask(formatAmount(preview.statementOpeningBalance))} /> : null}
              {preview.statementClosingBalance != null ? <KV label="Closing balance" value={mask(formatAmount(preview.statementClosingBalance))} /> : null}
              {account ? <KV label={`${account.accountName} now`} value={mask(formatAmount(account.currentBalance))} /> : null}
              <KV label="New" strong value={String(preview.newCount)} />
              <KV label="Already booked" value={String(preview.duplicateCount)} />
              <KV label="Without category" value={String(preview.uncategorisedCount)} color={preview.uncategorisedCount ? theme.accent : undefined} />
            </Card>

            {plain.length ? (
              <Card style={{ marginTop: space.sm }}>
                {plain.map((w, i) => (
                  <Text key={i} style={[type.label, { color: theme.accent }]}>
                    {maskIbansIn(w)}
                  </Text>
                ))}
              </Card>
            ) : null}

            {diagnostics.map((d, i) => (
              <View key={i}>
                <Section
                  title="Diagnostics"
                  detail="redacted"
                  action="Copy"
                  onAction={async () => {
                    await Clipboard.setStringAsync(maskIbansIn(d));
                    toast.success('Copied', 'Paste it to an agent to fix the parser.');
                  }}
                />
                <View style={[styles.diag, { backgroundColor: theme.bgRecessed, borderColor: theme.hairline }]}>
                  <ScrollView horizontal>
                    <Text selectable style={[styles.mono, { color: theme.textMuted }]}>
                      {maskIbansIn(d)}
                    </Text>
                  </ScrollView>
                </View>
              </View>
            ))}

            <Section
              title="Entries"
              detail={`${included.length} of ${rows.length} · ${sum < 0 ? '−' : '+'}${mask(formatAmount(sum), 'all')}`}
              action={rows.every((r) => r.include || r.duplicate) ? 'Include dupes' : 'New only'}
              onAction={() => {
                const allNew = rows.every((r) => r.include || r.duplicate);
                setRows(rows.map((r) => ({ ...r, include: allNew ? true : !r.duplicate })));
              }}
            />
            <Card padded={false}>
              {rows.map((r, i) => {
                const transfer = r.kind === 'TRANSFER_IN' || r.kind === 'TRANSFER_OUT';
                const income = r.kind === 'INCOME' || r.kind === 'TRANSFER_IN';
                return (
                  <View key={r.line} style={{ opacity: r.include ? 1 : 0.45 }}>
                    {i > 0 ? <Divider /> : null}
                    <View style={styles.row}>
                      <Pressable
                        onPress={() => {
                          tick();
                          setRows(rows.map((x, j) => (j === i ? { ...x, include: !x.include } : x)));
                        }}
                        hitSlop={8}
                      >
                        <Ionicons name={r.include ? 'checkbox' : 'square-outline'} size={20} color={r.include ? theme.text : theme.textFaint} />
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Text style={[type.body, { color: theme.text }]} numberOfLines={1}>
                          {maskIbansIn(r.description || r.rawDescription || '—')}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', marginTop: 2 }}>
                          <Text style={[type.caption, { color: theme.textFaint }]}>{shortDay(r.date)}</Text>
                          {r.duplicate ? <Text style={[type.caption, { color: theme.textFaint }]}>· already booked</Text> : null}
                          {r.currencyMismatch ? <Text style={[type.caption, { color: theme.negative }]}>· {r.currency}</Text> : null}
                          {transfer ? null : (
                            <Pressable
                              onPress={() => setEditing(i)}
                              style={[
                                styles.cat,
                                {
                                  borderColor: r.categoryLabel ? theme.hairline : theme.accent,
                                  backgroundColor: r.categoryLabel ? theme.keypad : 'transparent',
                                },
                              ]}
                            >
                              <Text style={[type.caption, { color: r.categoryLabel ? theme.textMuted : theme.accent, letterSpacing: 0.2 }]} numberOfLines={1}>
                                {r.categoryLabel ?? 'set category'}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                      <Text style={[type.amount, { color: income ? theme.positive : theme.text, fontSize: 15 }]}>
                        {income ? '+' : '−'}
                        {mask(formatAmount(r.amount), 'all')}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {rows.length === 0 ? <Text style={[type.label, { color: theme.textFaint, padding: space.lg }]}>No entries found in this file.</Text> : null}
            </Card>
          </>
        ) : null}
      </ScrollView>

      {preview && rows.length ? (
        <View style={[styles.bar, { bottom: insets.bottom + space.md, backgroundColor: theme.bgElevated, borderColor: theme.hairline }]}>
          <Text style={[type.caption, { color: missing ? theme.accent : theme.textFaint, flex: 1, letterSpacing: 0.2 }]} numberOfLines={2}>
            {missing ? `${missing} without category go to the default category` : `${included.length} entries ready`}
          </Text>
          <Btn primary label={busy === 'booking' ? 'Booking…' : `Book ${included.length}`} disabled={!included.length || busy !== null} onPress={commit} />
        </View>
      ) : null}

      <CategoryPicker
        visible={editing !== null}
        kind={editingRow ? (editingRow.kind === 'INCOME' ? 'INCOME' : 'EXPENSE') : null}
        allowNone
        onClose={() => setEditing(null)}
        onPick={(label) => {
          if (editing !== null) setRows(rows.map((x, j) => (j === editing ? { ...x, categoryLabel: label } : x)));
          setEditing(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  cat: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1, maxWidth: 150 },
  diag: { marginHorizontal: space.lg, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md, maxHeight: 280 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 11, lineHeight: 15 },
  bar: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    paddingLeft: space.lg,
    borderRadius: radius.lg + 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
