import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { DocumentPickerAsset } from 'expo-document-picker';

/** Reading picked files and handing generated ones to the share sheet. */

/** Upload ceiling for statements, matching the backend's limit. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type PickedKind = 'csv' | 'pdf' | 'xml' | 'unknown';

export function kindOf(asset: Pick<DocumentPickerAsset, 'name' | 'mimeType'>): PickedKind {
  const name = asset.name.toLowerCase();
  const mime = (asset.mimeType ?? '').toLowerCase();
  if (name.endsWith('.pdf') || mime.includes('pdf')) return 'pdf';
  if (name.endsWith('.xml') || mime.includes('xml')) return 'xml';
  if (name.endsWith('.csv') || name.endsWith('.txt') || mime.includes('csv') || mime.startsWith('text/')) return 'csv';
  return 'unknown';
}

async function blobOf(asset: DocumentPickerAsset): Promise<Blob> {
  if (asset.file) return asset.file;
  const res = await fetch(asset.uri);
  return res.blob();
}

/** The file as base64 without a data-URL prefix. */
export async function readBase64(asset: DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web') {
    const blob = await blobOf(asset);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return dataUrl.slice(dataUrl.indexOf(',') + 1);
  }
  return new File(asset.uri).base64();
}

export async function readText(asset: DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web') return (await blobOf(asset)).text();
  return new File(asset.uri).text();
}

/** Writes `content` to a cache file and opens the share sheet (Files, Mail, AirDrop). */
export async function shareTextFile(name: string, content: string, mimeType: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name, UTI: mimeType === 'text/csv' ? 'public.comma-separated-values-text' : 'public.json' });
}
