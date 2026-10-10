import { FILE_LIMITS } from './enquiry.ts';

export interface EnquiryAttachment {
  name: string;
  type: string;
  size: number;
}

export interface AttachmentLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  description: string;
}

/** FormSubmit documents a 10 MB combined attachment limit. Use decimal MB conservatively. */
export function attachmentLimits(provider: string): AttachmentLimits {
  if (provider === 'lead-api') {
    return { ...FILE_LIMITS, description: 'Up to 8 files, 12 MiB per file and 36 MiB in total.' };
  }
  return {
    maxFiles: FILE_LIMITS.maxFiles,
    maxFileBytes: 10_000_000,
    maxTotalBytes: 10_000_000,
    description: 'Up to 8 files and 10 MB in total.',
  };
}

const MIME_BY_EXTENSION: Record<string, readonly string[]> = {
  jpg: ['image/jpeg'], jpeg: ['image/jpeg'], png: ['image/png'], webp: ['image/webp'],
  heic: ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'],
  heif: ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'],
  pdf: ['application/pdf'],
};

/** Selection checks improve feedback; the provider remains responsible for inspecting uploaded bytes. */
export function validateAttachments(files: readonly EnquiryAttachment[], provider: string): string | null {
  const limits = attachmentLimits(provider);
  if (files.length > limits.maxFiles) return 'Choose no more than 8 files. Remove a file to continue.';
  let total = 0;
  for (const file of files) {
    const extension = file.name.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase() || '';
    const acceptedMime = Object.hasOwn(MIME_BY_EXTENSION, extension) ? MIME_BY_EXTENSION[extension] : undefined;
    const type = file.type.toLowerCase();
    // Some browsers expose HEIC and other selected files with no MIME type, or as generic binary.
    if (!acceptedMime || (type && type !== 'application/octet-stream' && !acceptedMime.includes(type))) {
      return 'Choose JPEG, PNG, WebP, HEIC, HEIF or PDF files. Remove the unsupported file to continue.';
    }
    if (!Number.isFinite(file.size) || file.size <= 0) return 'An attachment is empty or unreadable. Remove it and choose the file again.';
    if (file.size > limits.maxFileBytes) {
      return provider === 'lead-api'
        ? 'Each attachment must be 12 MiB or smaller. Choose a smaller file to continue.'
        : 'Attachments must total 10 MB or less. Remove or reduce a file to continue.';
    }
    total += file.size;
  }
  if (total > limits.maxTotalBytes) {
    return provider === 'lead-api'
      ? 'Attachments must total 36 MiB or less. Remove or reduce a file to continue.'
      : 'Attachments must total 10 MB or less. Remove or reduce a file to continue.';
  }
  return null;
}
