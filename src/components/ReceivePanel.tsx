import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  ClipboardPaste,
  Clock,
  Search,
} from 'lucide-react';
import {
  downloadShareFile,
  formatBytes,
  formatRemainingTime,
  lookupShareById,
  ShareRecord,
  TransferProgress,
} from '../lib/fileTransfer';
import { FileTypeIcon } from './FileTypeIcon';

interface ReceivePanelProps {
  initialShareId?: string;
}

export function ReceivePanel({ initialShareId = '' }: ReceivePanelProps) {
  const [shareIdInput, setShareIdInput] = useState(initialShareId);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundShare, setFoundShare] = useState<ShareRecord | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<TransferProgress | null>(null);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const runLookup = useCallback(async (idToFind: string) => {
    const trimmed = idToFind.trim();
    if (!trimmed) {
      setError('Enter a Share ID to locate a file.');
      setFoundShare(null);
      return;
    }

    setSearching(true);
    setError(null);
    setDownloadComplete(false);
    setDownloadProgress(null);

    try {
      const result = await lookupShareById(trimmed);
      if (result.status === 'found') {
        setFoundShare(result.share);
        setNowMs(Date.now());
      } else {
        setFoundShare(null);
        setError(result.reason);
      }
    } catch (err) {
      setFoundShare(null);
      setError(err instanceof Error ? err.message : 'Unable to look up that Share ID.');
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (initialShareId.trim()) {
      setShareIdInput(initialShareId.trim());
      void runLookup(initialShareId.trim());
    }
  }, [initialShareId, runLookup]);

  useEffect(() => {
    if (!foundShare) return;
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [foundShare]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runLookup(shareIdInput);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        let extracted = text.trim();
        try {
          const parsedUrl = new URL(extracted);
          const idParam = parsedUrl.searchParams.get('id');
          if (idParam) extracted = idParam;
        } catch {
          // Plain Share ID
        }
        setShareIdInput(extracted);
        void runLookup(extracted);
      }
    } catch {
      setError('Clipboard read was blocked by your browser. Paste manually into the box.');
    }
  };

  const handleDownload = async () => {
    if (!foundShare || downloading) return;
    setError(null);
    setDownloading(true);
    setDownloadComplete(false);

    try {
      await downloadShareFile(foundShare, setDownloadProgress);
      setDownloadComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloading(false);
    }
  };

  const isExpired = foundShare ? foundShare.expiresAt.toMillis() <= nowMs : false;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <label
          htmlFor="share-id-input"
          className="block text-sm font-medium text-slate-800 dark:text-slate-200"
        >
          Enter Share ID
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              id="share-id-input"
              type="text"
              value={shareIdInput}
              onChange={(e) => setShareIdInput(e.target.value)}
              placeholder="e.g. flx-8k4m2p9q"
              autoComplete="off"
              spellCheck={false}
              className="w-full pl-3.5 pr-10 py-3 text-sm font-mono bg-[#F7F8FA] dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="button"
              onClick={handlePaste}
              title="Paste Share ID from clipboard"
              aria-label="Paste Share ID from clipboard"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md transition-colors"
            >
              <ClipboardPaste className="w-4 h-4" />
            </button>
          </div>
          <button
            type="submit"
            disabled={searching}
            className="inline-flex items-center gap-1.5 px-5 py-3 text-sm font-medium text-white bg-slate-900 dark:bg-slate-800 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Search className="w-4 h-4" />
            <span>{searching ? 'Finding...' : 'Find File'}</span>
          </button>
        </div>
      </form>

      {searching ? (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 animate-pulse">
          <div className="h-4 w-2/3 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-lg mt-4" />
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-4 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/70 rounded-xl"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : foundShare ? (
        <div className="space-y-5">
          <div className="bg-[#F7F8FA] dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <FileTypeIcon mimeType={foundShare.fileType} className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">
                  {foundShare.fileName}
                </p>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span className="font-mono">{formatBytes(foundShare.fileSize)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{foundShare.fileType}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Available for</span>
              <span
                className={`inline-flex items-center gap-1.5 font-mono font-medium ${
                  isExpired
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {formatRemainingTime(foundShare.expiresAt.toMillis(), nowMs)}
              </span>
            </div>

            {downloading && downloadProgress && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>
                    Downloading chunk {downloadProgress.completedChunks} of{' '}
                    {downloadProgress.totalChunks}
                  </span>
                  <span className="font-mono font-medium">{downloadProgress.percent}%</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-150"
                    style={{ width: `${downloadProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            {downloadComplete && (
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>File downloaded successfully.</span>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={downloading || isExpired}
            onClick={handleDownload}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>
              {downloading
                ? 'Downloading...'
                : isExpired
                  ? 'File Expired'
                  : 'Download File'}
            </span>
          </button>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 border-dashed rounded-xl py-10 px-6 text-center bg-[#F7F8FA]/60 dark:bg-slate-950/60">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Ready to retrieve a file
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
            Enter the unique <span className="font-mono">flx-</span> Share ID provided by the
            sender.
          </p>
        </div>
      )}
    </div>
  );
}
