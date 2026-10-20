// Client-side helpers for the SMM marketplace UI.

export interface UploadedFile {
  url: string;
  tgMessageId?: number | null;
  size?: number;
  kind?: string;
}

/** Upload a raw file through the SAME route test attachments use
 * (Telegram channel when configured, small data: URL fallback). */
export async function uploadSmmFile(file: File): Promise<UploadedFile> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/attachments/upload', { method: 'POST', body: fd });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(e.error || 'Upload failed');
  }
  return await res.json();
}

/** Best-effort Attachment "type" from the mime type (same enum as Attachment). */
export function sniffType(file: File): string {
  const t = file.type || '';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (t === 'application/pdf') return 'pdf';
  return 'link';
}

// The SMM card palette (no tags/topics here — hash the id for stability)
export function smmCoverClass(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 99991;
  const palette = ['bg-[#E3EEFF]', 'bg-[#DFF3E8]', 'bg-[#FFF0D9]', 'bg-[#FCE8F2]'];
  return palette[h % palette.length];
}

export function smmCoverColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 99991;
  const palette = ['#E3EEFF', '#DFF3E8', '#FFF0D9', '#FCE8F2'];
  return palette[h % palette.length];
}
