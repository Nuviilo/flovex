/**
 * Validation constants synchronized verbatim with firebase-blueprint.json
 * and firestore.rules volumetric & structural boundaries.
 */

export const SHARE_ID_MIN_LENGTH = 6;
export const SHARE_ID_MAX_LENGTH = 32;
export const SHARE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const MAX_FILENAME_LENGTH = 255;
export const MAX_FILETYPE_LENGTH = 128;

export const CHUNK_SIZE_BYTES = 450_000;
export const MAX_CHUNKS = 35;
export const MAX_FILE_SIZE_BYTES = 15_728_640; // 15 MiB

export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 43_200; // 30 days

export interface DurationPreset {
  id: string;
  label: string;
  minutes: number;
}

export const DURATION_PRESETS: DurationPreset[] = [
  { id: '15m', label: '15 min', minutes: 15 },
  { id: '1h', label: '1 hour', minutes: 60 },
  { id: '24h', label: '24 hours', minutes: 1_440 },
  { id: '7d', label: '7 days', minutes: 10_080 },
  { id: '30d', label: '30 days', minutes: 43_200 },
];
