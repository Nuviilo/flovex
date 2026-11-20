import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  Link2,
  RotateCcw,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  DURATION_PRESETS,
  MAX_DURATION_MINUTES,
  MAX_FILE_SIZE_BYTES,
  MIN_DURATION_MINUTES,
} from '../lib/blueprint';
import {
  clampDurationMinutes,
  formatBytes,
  formatDateTime,
  formatRemainingTime,
  ShareRecord,
  TransferProgress,
  uploadFileToFirestore,
} from '../lib/fileTransfer';
import { FileTypeIcon } from './FileTypeIcon';

type CustomUnit = 'minutes' | 'hours' | 'days';

export function UploadPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [presetId, setPresetId] = useState<string>('24h');
  const [customValue, setCustomValue] = useState<string>('2');
  const [customUnit, setCustomUnit] = useState<CustomUnit>('hours');

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedShare, setCompletedShare] = useState<ShareRecord | null>(null);
  const [copiedField, setCopiedField] = useState<'id' | 'link' | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!completedShare) return;
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [completedShare]);

  const resolvedMinutes = (() => {
    if (presetId !== 'custom') {
      const found = DURATION_PRESETS.find((p) => p.id === presetId);
      return found ? found.minutes : 1440;
    }
    const parsed = Number(customValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return MIN_DURATION_MINUTES;
    const multiplier =
      customUnit === 'days' ? 1440 : customUnit === 'hours' ? 60 : 1;
    return clampDurationMinutes(parsed * multiplier);
  })();

  const validateAndStageFile = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (file.size <= 0) {
      setError('This file is empty (0 bytes) and cannot be shared.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(
        `File is ${formatBytes(file.size)}. Maximum supported size is ${formatBytes(MAX_FILE_SIZE_BYTES)}.`
      );
      return;
    }
    setCompletedShare(null);
    setSelectedFile(file);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    if (dragDepthRef.current === 1) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);

    if (uploading) return;
    const droppedFile = e.dataTransfer?.files?.[0];
    validateAndStageFile(droppedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    validateAndStageFile(file);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile || uploading) return;
    setError(null);
    setUploading(true);
    setProgress({ completedChunks: 0, totalChunks: 1, percent: 0 });

    try {
      const share = await uploadFileToFirestore({
        file: selectedFile,
        durationMinutes: resolvedMinutes,
        onProgress: setProgress,
      });
      setCompletedShare(share);
      setNowMs(Date.now());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleCopy = async (kind: 'id' | 'link') => {
    if (!completedShare) return;
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('id', completedShare.shareId);

    const text = kind === 'id' ? completedShare.shareId : url.toString();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(kind);
      window.setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setError('Clipboard copy was blocked by your browser.');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setCompletedShare(null);
    setProgress(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {completedShare ? (
        <div className="space-y-6">
          <div className="bg-[#F7F8FA] border border-slate-200 rounded-xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <Check className="w-4 h-4" />
                File ready to share
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {formatRemainingTime(completedShare.expiresAt.toMillis(), nowMs)} left
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-1.5">Share ID</p>
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3.5">
              <span className="font-mono text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 select-all">
                {completedShare.shareId}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy('id')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
                >
                  {copiedField === 'id' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Copied ID
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy ID
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy('link')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap"
                >
                  {copiedField === 'link' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied Link
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3.5 h-3.5" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="font-medium text-slate-700 truncate max-w-[260px]">
                {completedShare.fileName}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{formatBytes(completedShare.fileSize)}</span>
              <span aria-hidden="true">·</span>
              <span>Expires {formatDateTime(completedShare.expiresAt.toMillis())}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Send another file
          </button>
        </div>
      ) : (
        <>
          <div
            role="button"
            tabIndex={0}
            aria-label="Drag and drop a file here or press Enter to browse"
            onClick={() => !uploading && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-xl border-2 border-dashed transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              isDragging
                ? 'border-blue-600 bg-blue-50/70 scale-[1.005]'
                : selectedFile
                  ? 'border-slate-300 bg-[#F7F8FA] hover:border-slate-400'
                  : 'border-slate-300 bg-[#F7F8FA] hover:border-blue-500 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="sr-only"
              disabled={uploading}
            />

            {selectedFile ? (
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-blue-600 shrink-0">
                    <FileTypeIcon mimeType={selectedFile.type} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {selectedFile.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className="font-mono">{formatBytes(selectedFile.size)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-[200px]">
                        {selectedFile.type || 'Binary file'}
                      </span>
                    </div>
                  </div>
                </div>

                {!uploading && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setError(null);
                    }}
                    aria-label="Remove selected file"
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="py-12 px-6 text-center">
                <div
                  className={`w-12 h-12 rounded-xl mx-auto mb-3.5 flex items-center justify-center border transition-colors ${
                    isDragging
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-slate-900">
                  {isDragging ? 'Drop file to upload' : 'Drag and drop a file here'}
                </p>
                <p className="text-xs text-slate-500 mt-1.5">
                  or{' '}
                  <span className="text-blue-600 font-medium underline underline-offset-2">
                    browse from your device
                  </span>{' '}
                  · Up to {formatBytes(MAX_FILE_SIZE_BYTES)}
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-4 mb-2.5">
              <label className="text-sm font-medium text-slate-800">
                Keep file available for
              </label>
              <span className="text-xs text-slate-500 font-mono">
                Until {formatDateTime(Date.now() + resolvedMinutes * 60_000)}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 bg-slate-100 rounded-lg">
              {DURATION_PRESETS.map((preset) => {
                const active = presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={uploading}
                    onClick={() => setPresetId(preset.id)}
                    className={`px-2.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={uploading}
                onClick={() => setPresetId('custom')}
                className={`px-2.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  presetId === 'custom'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Custom
              </button>
            </div>

            {presetId === 'custom' && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min={MIN_DURATION_MINUTES}
                  max={MAX_DURATION_MINUTES}
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  disabled={uploading}
                  aria-label="Custom duration value"
                  className="w-24 px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(['minutes', 'hours', 'days'] as CustomUnit[]).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      disabled={uploading}
                      onClick={() => setCustomUnit(unit)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
                        customUnit === unit
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-slate-500 ml-auto hidden sm:inline">
                  1 min – 30 days
                </span>
              </div>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {uploading && progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>
                  Uploading chunk {progress.completedChunks} of {progress.totalChunks}
                </span>
                <span className="font-mono font-medium">{progress.percent}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-150"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!selectedFile || uploading}
            onClick={handleUpload}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            {uploading ? 'Uploading...' : 'Upload & Get Share ID'}
          </button>
        </>
      )}
    </div>
  );
}
