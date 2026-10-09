/**
 * Server-side file checks. Types are sniffed from bytes.
 * JPEG APP segments and PNG text/EXIF chunks are dropped so derived files
 * do not keep camera location data. PDFs are stored and never executed.
 */

export type SniffedType = 'jpeg' | 'png' | 'webp' | 'pdf' | 'heic' | 'unknown';

export function sniffType(data: Uint8Array): SniffedType {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'jpeg';
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'png';
  if (data.length >= 12 && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
    return 'webp';
  }
  if (data.length >= 5 && data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46) return 'pdf';
  if (data.length >= 12 && data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) {
    const brand = String.fromCharCode(data[8], data[9], data[10], data[11]).toLowerCase();
    if (brand.startsWith('hei') || brand.startsWith('mif') || brand === 'msf1' || brand === 'hevc') return 'heic';
  }
  return 'unknown';
}

export function extensionFor(type: SniffedType): string {
  if (type === 'jpeg') return 'jpg';
  if (type === 'heic') return 'heic';
  return type;
}

function readU16(data: Uint8Array, offset: number): number {
  return (data[offset] << 8) | data[offset + 1];
}

/** Drop APP1, APP2 and APP13 so EXIF/GPS and IPTC do not remain in the JPEG. */
export function stripJpegMetadata(data: Uint8Array): Uint8Array {
  if (sniffType(data) !== 'jpeg') return data;
  const chunks: Uint8Array[] = [data.subarray(0, 2)];
  let i = 2;
  while (i + 1 < data.length) {
    if (data[i] !== 0xff) {
      chunks.push(data.subarray(i));
      break;
    }
    const marker = data[i + 1];
    if (marker === 0xda || marker === 0xd9) {
      chunks.push(data.subarray(i));
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      chunks.push(data.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 3 >= data.length) break;
    const length = readU16(data, i + 2);
    if (length < 2 || i + 2 + length > data.length) break;
    const drop = marker === 0xe1 || marker === 0xe2 || marker === 0xed;
    if (!drop) chunks.push(data.subarray(i, i + 2 + length));
    i += 2 + length;
  }
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

const PNG_DROP = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);

function readU32(data: Uint8Array, offset: number): number {
  return data[offset] * 0x1000000 + (data[offset + 1] << 16) + (data[offset + 2] << 8) + data[offset + 3];
}

/** Drop ancillary text and EXIF chunks. Image data chunks are kept. */
export function stripPngMetadata(data: Uint8Array): Uint8Array {
  if (sniffType(data) !== 'png' || data.length < 8) return data;
  const chunks: Uint8Array[] = [data.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= data.length) {
    const length = readU32(data, i);
    const end = i + 12 + length;
    if (length < 0 || end > data.length) break;
    const type = String.fromCharCode(data[i + 4], data[i + 5], data[i + 6], data[i + 7]);
    if (!PNG_DROP.has(type)) chunks.push(data.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function prepareUpload(data: Uint8Array): { type: SniffedType; bytes: Uint8Array; metadata: 'stripped' | 'stored' | 'rejected' } {
  const type = sniffType(data);
  if (type === 'unknown') return { type, bytes: data, metadata: 'rejected' };
  if (type === 'jpeg') return { type, bytes: stripJpegMetadata(data), metadata: 'stripped' };
  if (type === 'png') return { type, bytes: stripPngMetadata(data), metadata: 'stripped' };
  return { type, bytes: data, metadata: 'stored' };
}
