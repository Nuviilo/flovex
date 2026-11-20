import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import {
  CHUNK_SIZE_BYTES,
  MAX_CHUNKS,
  MAX_DURATION_MINUTES,
  MAX_FILENAME_LENGTH,
  MAX_FILETYPE_LENGTH,
  MAX_FILE_SIZE_BYTES,
  MIN_DURATION_MINUTES,
  SHARE_ID_MAX_LENGTH,
  SHARE_ID_MIN_LENGTH,
  SHARE_ID_PATTERN,
} from './blueprint';
import { db, handleFirestoreError, OperationType } from './firebase';

export interface ShareRecord {
  shareId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  chunkCount: number;
  chunkSize: number;
  durationMinutes: number;
  createdAt: Timestamp | null;
  expiresAt: Timestamp;
}

export interface TransferProgress {
  completedChunks: number;
  totalChunks: number;
  percent: number;
}

const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function generateShareId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let suffix = '';
  for (let i = 0; i < bytes.length; i++) {
    suffix += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  }
  return `flx-${suffix}`;
}

export function sanitizeShareId(raw: string): string {
  return raw.trim();
}

export function isValidShareIdFormat(id: string): boolean {
  return (
    id.length >= SHARE_ID_MIN_LENGTH &&
    id.length <= SHARE_ID_MAX_LENGTH &&
    SHARE_ID_PATTERN.test(id)
  );
}

export function clampDurationMinutes(minutes: number): number {
  const rounded = Math.round(minutes);
  if (!Number.isFinite(rounded)) return 60;
  return Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, rounded));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, index);
  return `${value >= 10 || index === 0 ? value.toFixed(index === 0 ? 0 : 1) : value.toFixed(2)} ${units[index]}`;
}

export function formatRemainingTime(expiresAtMs: number, nowMs: number): string {
  const diffMs = expiresAtMs - nowMs;
  if (diffMs <= 0) return 'Expired';

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

export function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const sliceSize = 0x8000;
  for (let i = 0; i < bytes.length; i += sliceSize) {
    const chunk = bytes.subarray(i, i + sliceSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function uploadFileToFirestore(params: {
  file: File;
  durationMinutes: number;
  onProgress?: (progress: TransferProgress) => void;
}): Promise<ShareRecord> {
  const { file, durationMinutes, onProgress } = params;

  if (file.size <= 0) {
    throw new Error('Selected file is empty. Please choose a non-empty file.');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File exceeds the ${formatBytes(MAX_FILE_SIZE_BYTES)} Firestore storage limit.`
    );
  }

  const safeMinutes = clampDurationMinutes(durationMinutes);
  const safeFileName = (file.name || 'untitled-file').slice(0, MAX_FILENAME_LENGTH);
  const safeFileType = (file.type || 'application/octet-stream').slice(0, MAX_FILETYPE_LENGTH);

  const buffer = await file.arrayBuffer();
  const totalBytes = new Uint8Array(buffer);
  const chunkCount = Math.ceil(totalBytes.length / CHUNK_SIZE_BYTES);

  if (chunkCount < 1 || chunkCount > MAX_CHUNKS) {
    throw new Error(`File requires ${chunkCount} chunks, exceeding the limit of ${MAX_CHUNKS}.`);
  }

  const shareId = generateShareId();
  const expiresAt = Timestamp.fromMillis(Date.now() + safeMinutes * 60_000);
  const sharePath = `shares/${shareId}`;

  onProgress?.({ completedChunks: 0, totalChunks: chunkCount, percent: 0 });

  try {
    await setDoc(doc(db, 'shares', shareId), {
      shareId,
      fileName: safeFileName,
      fileType: safeFileType,
      fileSize: totalBytes.length,
      chunkCount,
      chunkSize: CHUNK_SIZE_BYTES,
      durationMinutes: safeMinutes,
      createdAt: serverTimestamp(),
      expiresAt,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, sharePath);
  }

  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_SIZE_BYTES;
    const end = Math.min(start + CHUNK_SIZE_BYTES, totalBytes.length);
    const chunkBytes = totalBytes.subarray(start, end);
    const encoded = uint8ArrayToBase64(chunkBytes);

    const chunkPath = `shares/${shareId}/chunks/${i}`;
    try {
      await setDoc(doc(db, 'shares', shareId, 'chunks', String(i)), {
        index: i,
        data: encoded,
      });
    } catch (chunkErr) {
      handleFirestoreError(chunkErr, OperationType.CREATE, chunkPath);
    }

    const completed = i + 1;
    onProgress?.({
      completedChunks: completed,
      totalChunks: chunkCount,
      percent: Math.round((completed / chunkCount) * 100),
    });
  }

  return {
    shareId,
    fileName: safeFileName,
    fileType: safeFileType,
    fileSize: totalBytes.length,
    chunkCount,
    chunkSize: CHUNK_SIZE_BYTES,
    durationMinutes: safeMinutes,
    createdAt: Timestamp.now(),
    expiresAt,
  };
}

export type LookupResult =
  | { status: 'found'; share: ShareRecord }
  | { status: 'unavailable'; reason: string };

export async function lookupShareById(rawId: string): Promise<LookupResult> {
  const shareId = sanitizeShareId(rawId);
  if (!isValidShareIdFormat(shareId)) {
    return {
      status: 'unavailable',
      reason: 'Enter a valid Share ID (6–32 alphanumeric characters, hyphens, or underscores).',
    };
  }

  const sharePath = `shares/${shareId}`;
  try {
    const snap = await getDoc(doc(db, 'shares', shareId));
    if (!snap.exists()) {
      return {
        status: 'unavailable',
        reason: 'No file found for this ID, or its availability window has expired.',
      };
    }

    const data = snap.data() as ShareRecord;
    if (data.expiresAt.toMillis() <= Date.now()) {
      return {
        status: 'unavailable',
        reason: 'This file transfer has expired and is no longer available.',
      };
    }

    return { status: 'found', share: data };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('permission') || message.includes('insufficient')) {
      return {
        status: 'unavailable',
        reason: 'File not found or its availability window has expired.',
      };
    }
    handleFirestoreError(error, OperationType.GET, sharePath);
  }
}

export async function downloadShareFile(
  share: ShareRecord,
  onProgress?: (progress: TransferProgress) => void
): Promise<void> {
  const parts: Uint8Array[] = [];
  onProgress?.({ completedChunks: 0, totalChunks: share.chunkCount, percent: 0 });

  for (let i = 0; i < share.chunkCount; i++) {
    const chunkPath = `shares/${share.shareId}/chunks/${i}`;
    let chunkSnap;
    try {
      chunkSnap = await getDoc(doc(db, 'shares', share.shareId, 'chunks', String(i)));
    } catch (error) {
      const msg = error instanceof Error ? error.message.toLowerCase() : '';
      if (msg.includes('permission') || msg.includes('insufficient')) {
        throw new Error('This file expired during download.');
      }
      handleFirestoreError(error, OperationType.GET, chunkPath);
    }

    if (!chunkSnap.exists()) {
      throw new Error(`File chunk ${i + 1} is missing or expired.`);
    }

    const chunkData = chunkSnap.data() as { data: string };
    parts.push(base64ToUint8Array(chunkData.data));

    const completed = i + 1;
    onProgress?.({
      completedChunks: completed,
      totalChunks: share.chunkCount,
      percent: Math.round((completed / share.chunkCount) * 100),
    });
  }

  const totalLength = parts.reduce((acc, part) => acc + part.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }

  const mime = share.fileType || 'application/octet-stream';
  const androidBridge = (
    window as unknown as {
      AndroidDownloader?: {
        saveBase64File: (base64: string, fileName: string, mimeType: string) => void;
      };
    }
  ).AndroidDownloader;

  if (androidBridge && typeof androidBridge.saveBase64File === 'function') {
    const base64Full = uint8ArrayToBase64(combined);
    androidBridge.saveBase64File(base64Full, share.fileName, mime);
    return;
  }

  const blob = new Blob([combined], { type: mime });
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = share.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 5000);
}
