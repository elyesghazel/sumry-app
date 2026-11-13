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
import {
  MAX_IMPORT_BYTES,
  formatAmount,
  importFormatFor,
  maskIbansIn,
  reconcileOffer,
  rowsForCheck,
  splitImportWarnings,
  statementFileKind,
  type ImportCheck,
  type ImportPreview,
  type ImportRow,
} from '../src/core';
import { api } from '../src/api';
import { readBase64, readText } from '../src/lib/files';
import { shortDay } from '../src/lib/dates';
import { usePreferences, useTheme } from '../src/preferences';
import { radius, space, type } from '../src/theme';

const TYPES = ['application/pdf', 'text/csv', 'text/comma-separated-values', 'application/xml', 'text/xml', 'text/plain'];

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
  const { accounts, transactions, token, mutate } = useApp();
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
  const [check, setCheck] = useState<ImportCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);

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
    if (asset.size && asset.size > MAX_IMPORT_BYTES) {
      setError(`${asset.name} is ${(asset.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`);
      return;
    }
    setFile({ name: asset.name, size: asset.size });
    setPreview(null);
    setRows([]);
    setBusy('reading');
    try {
      const kind = statementFileKind(asset.name, asset.mimeType);
      if (!kind) throw new Error(`${asset.name} is not a PDF, XML or CSV statement.`);
      const format = importFormatFor(kind);
      const input =
        kind === 'csv'
          ? { accountId, format, csv: await readText(asset), fileName: asset.name }
          : { accountId, format, fileBase64: await readBase64(asset), fileName: asset.name };
      const p = await api.importPreview(token, input);
      setPreview(p);
      setCheck(null);
      setRemoved([]);
      setRows(p.rows.map((r) => ({ ...r, include: !r.duplicate })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the statement');
    } finally {
      setBusy(null);
    }
  };

  /** Claude looks at the rows nothing matched; its verdicts only pre-set the choices. */
  const askClaude = async () => {
    if (!token || !preview) return;
    const open = rowsForCheck(preview.rows);
    if (!open.length) return;
    tick();
    setChecking(true);
    try {
      const res = await api.importCheck(token, {
        accountId: preview.accountId,
        rows: open,
        matchedIds: preview.rows.flatMap((r) => r.matchIds ?? (r.duplicateOfId ? [r.duplicateOfId] : [])),
        statementFrom: preview.statementFrom ?? null,
        statementTo: preview.statementTo ?? null,
      });
      setCheck(res);
      const byLine = new Map(res.suggestions.map((v) => [v.line, v]));
      setRows((cur) =>
        cur.map((r) => {
          const v = byLine.get(r.line);
          if (!v) return r;
          if (v.verdict !== 'new') return { ...r, include: false };
          return !r.categoryLabel && v.categoryLabel ? { ...r, categoryLabel: v.categoryLabel } : r;
        }),
      );
    } catch (e) {
      toast.error('Claude check failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setChecking(false);
    }
  };

  const removeAdjustment = async (id: string, label: string) => {
    const ok = await confirm({
      title: 'Remove this adjustment?',
      message: `${label}\n\nOnly do this if you book the statement rows it covered, otherwise the balance is off again.`,
      confirmLabel: 'Remove',
      destructive: true,
      icon: 'trash-outline',
    });
    if (!ok) return;
    try {
      await mutate((t) => api.deleteTransaction(t, id));
      setRemoved((r) => [...r, id]);
      toast.success('Adjustment removed');
    } catch (e) {
      toast.error('Could not remove it', e instanceof Error ? e.message : 'Unknown error');
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
      const fresh = (await api.accounts(token)).find((a) => a.id === accountId);
      const offer = fresh ? reconcileOffer(preview, fresh.currentBalance) : null;
      if (fresh && offer) {
        const closing = offer.statementBalance;
        const diff = offer.difference;
        if (offer.matches) {
          // The statement proves the balance: stamp the account as checked.
          await mutate((t) => api.reconcileAccount(t, accountId, closing, 'Abgleich Kontoauszug')).catch(() => {});
        } else {
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
  const { notes: plain, diagnostics } = splitImportWarnings(warnings);
  const editingRow = editing !== null ? rows[editing] : null;
  const verdicts = useMemo(() => new Map((check?.suggestions ?? []).map((v) => [v.line, v])), [check]);
  const openCount = preview ? rowsForCheck(preview.rows).length : 0;

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
        <Hint text="Nothing is booked until you confirm. Rows with the same amount as an entry within 3 days count as already logged. IBANs arrive masked. Up to 10 MB." />

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
              <KV label="Already logged" value={String(preview.duplicateCount)} />
              {preview.balanceOk != null ? (
                <KV
                  label="Rows add up"
                  value={preview.balanceOk ? '✓ every booking read' : `✗ off by ${formatAmount((preview.statementClosingBalance ?? 0) - (preview.computedClosingBalance ?? 0))}`}
                  color={preview.balanceOk ? theme.positive : theme.negative}
                />
              ) : null}
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

            {preview.aiCheckAvailable && openCount > 0 ? (
              <Card style={{ marginTop: space.sm, gap: space.sm }}>
                <Text style={[type.label, { color: theme.text }]}>
                  {check ? check.summary || 'Claude checked the open rows.' : `${openCount} rows matched nothing. Claude can compare them with your entries around this period.`}
                </Text>
                {!check ? (
                  <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]}>
                    Sends the open rows (IBANs masked) and your entries on this account from that period. Nothing changes without you.
                  </Text>
                ) : null}
                {check?.adjustments
                  .filter((a) => !removed.includes(a.id))
                  .map((a) => {
                    const t = transactions.find((x) => x.id === a.id);
                    const label = t ? `${t.description || 'Abgleich'} · ${shortDay(t.date)} · ${formatAmount(t.amount)}` : 'An adjustment';
                    return (
                      <View key={a.id} style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.hairline, paddingTop: space.sm, gap: 4 }}>
                        <Text style={[type.label, { color: theme.accent }]}>Adjustment would count twice: {label}</Text>
                        <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]}>{a.note}</Text>
                        <Btn small danger label="Remove adjustment" onPress={() => removeAdjustment(a.id, label)} />
                      </View>
                    );
                  })}
                <Btn small label={checking ? 'Claude is checking…' : check ? 'Check again' : 'Check with Claude'} disabled={checking || busy !== null} onPress={askClaude} />
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
                          {r.duplicate ? (
                            <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2, flexShrink: 1 }]} numberOfLines={1}>
                              · = {r.matchNote ?? 'already logged'}
                            </Text>
                          ) : null}
                          {verdicts.get(r.line) ? (
                            <Text
                              style={[type.caption, { letterSpacing: 0.2, flexShrink: 1, color: verdicts.get(r.line)!.verdict === 'new' ? theme.positive : verdicts.get(r.line)!.verdict === 'logged' ? theme.accent : theme.negative }]}
                              numberOfLines={1}
                            >
                              · Claude: {verdicts.get(r.line)!.verdict === 'new' ? 'new' : verdicts.get(r.line)!.verdict === 'logged' ? `logged, ${verdicts.get(r.line)!.reason}` : verdicts.get(r.line)!.reason}
                            </Text>
                          ) : null}
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
