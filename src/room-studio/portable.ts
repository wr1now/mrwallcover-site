/** Portable JSON has one symmetric byte budget, independent of image/cloud quotas. */
export const PORTABLE_PROJECT_MAX_BYTES = 160 * 1024 * 1024;
export const PORTABLE_DOCUMENT_BUDGET_BYTES = PORTABLE_PROJECT_MAX_BYTES - 16384;

/** Exact compact UTF-8 JSON size without building one giant repeated-image string.
 * Metadata-only server snapshots may supply original texture byte lengths to
 * account for the data URLs that a later portable export will embed. */
export function portableJsonBytes(value: unknown, textureBytes?: ReadonlyMap<string, number>): number {
  const strings = new Map<string, number>(), parents = new Set<object>();
  function textBytes(text: string): number {
    const cached = strings.get(text); if (cached !== undefined) return cached;
    const bytes = text.startsWith('data:image/') && /^[\x20-\x21\x23-\x5b\x5d-\x7e]*$/.test(text) ? text.length + 2 : new TextEncoder().encode(JSON.stringify(text)).byteLength;
    strings.set(text, bytes); return bytes;
  }
  function count(item: unknown): number | undefined {
    if (item === null) return 4;
    if (typeof item === 'string') return textBytes(item);
    if (typeof item === 'number') return Number.isFinite(item) ? String(Object.is(item, -0) ? 0 : item).length : 4;
    if (typeof item === 'boolean') return item ? 4 : 5;
    if (typeof item === 'undefined' || typeof item === 'function' || typeof item === 'symbol') return undefined;
    if (typeof item !== 'object') throw new Error('This value cannot be saved as portable JSON.');
    if (parents.has(item)) throw new Error('A portable project cannot contain circular references.');
    parents.add(item);
    let result = 2;
    if (Array.isArray(item)) {
      for (const child of item) result += count(child) ?? 4;
      result += Math.max(0, item.length - 1);
    } else {
      const entries = Object.entries(item); let included = 0;
      for (const [key, child] of entries) {
        const size = count(child); if (size === undefined) continue;
        result += textBytes(key) + 1 + size + (included++ ? 1 : 0);
      }
      const asset = item as { id?: string; sha256?: string; mime?: string; widthPx?: number; heightPx?: number; dataUrl?: string };
      if (textureBytes && asset.id && asset.sha256 && asset.mime?.startsWith('image/') && asset.widthPx && asset.heightPx && !asset.dataUrl) {
        const bytes = textureBytes.get(asset.sha256);
        if (bytes !== undefined) result += (included ? 1 : 0) + textBytes('dataUrl') + 1 + 2 + `data:${asset.mime};base64,`.length + 4 * Math.ceil(bytes / 3);
      }
    }
    parents.delete(item); return result;
  }
  const result = count(value); if (result === undefined) throw new Error('There is no portable project to download.'); return result;
}
export function assertPortableJson(value: unknown, maximum = PORTABLE_PROJECT_MAX_BYTES, textureBytes?: ReadonlyMap<string, number>): void {
  if (portableJsonBytes(value, textureBytes) > maximum) throw new Error('This editable file would exceed 160 MB. Remove unused artwork or saved combinations, or use smaller originals before saving another comparison or downloading. Your previous project is unchanged.');
}
export function serializePortableJson(value: unknown): string {
  assertPortableJson(value); return JSON.stringify(value);
}
