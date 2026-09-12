import type { Attachment } from './gemini';

/** What Gemini accepts inline, narrowed to what a finance document would be. */
export const ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
];

// Inline request data is capped well below this by the API, but a phone photo
// can easily exceed what is sensible to send; reject early with a clear reason.
const MAX_BYTES = 15 * 1024 * 1024;

export function isAcceptedFile(file: File) {
  return ACCEPTED_TYPES.includes(file.type);
}

/** Reads a file into the base64 payload Gemini expects for inline data. */
export async function toAttachment(file: File): Promise<Attachment> {
  if (!isAcceptedFile(file)) {
    throw new Error(
      `${file.name} is a ${file.type || 'unknown'} file — attach a PNG, JPEG, WebP or PDF.`,
    );
  }
  if (file.size > MAX_BYTES) {
    throw new Error(
      `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB — attach something under 15MB.`,
    );
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // btoa over a large string built with spread blows the call stack, so
  // accumulate in chunks.
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }

  return {
    name: file.name,
    mimeType: file.type,
    data: btoa(binary),
  };
}
