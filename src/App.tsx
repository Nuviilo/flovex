/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { ReceivePanel } from './components/ReceivePanel';
import { UploadPanel } from './components/UploadPanel';

type ActiveMode = 'send' | 'receive';

export default function App() {
  const [mode, setMode] = useState<ActiveMode>('send');
  const [initialShareId, setInitialShareId] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam && idParam.trim()) {
      setInitialShareId(idParam.trim());
      setMode('receive');
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-900 flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[680px]">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              flovex
            </h1>

            <div
              role="tablist"
              aria-label="File transfer mode"
              className="inline-flex items-center gap-1 p-1 bg-slate-200/75 rounded-lg"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'send'}
                onClick={() => setMode('send')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === 'send'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Send a file
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'receive'}
                onClick={() => setMode('receive')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === 'receive'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Receive a file
              </button>
            </div>
          </div>

          <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
            {mode === 'send' ? (
              <UploadPanel />
            ) : (
              <ReceivePanel initialShareId={initialShareId} />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
