/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { ReceivePanel } from './components/ReceivePanel';
import { UploadPanel } from './components/UploadPanel';

type ActiveMode = 'send' | 'receive';

export default function App() {
  const [mode, setMode] = useState<ActiveMode>('send');
  const [initialShareId, setInitialShareId] = useState<string>('');
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam && idParam.trim()) {
      setInitialShareId(idParam.trim());
      setMode('receive');
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    document.documentElement.classList.toggle('dark', nextDark);
    try {
      localStorage.setItem('flovex-theme', nextDark ? 'dark' : 'light');
    } catch {
      // Ignore storage failures in restricted contexts
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-150">
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[680px]">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              flovex
            </h1>

            <div className="flex items-center gap-2.5">
              <div
                role="tablist"
                aria-label="File transfer mode"
                className="inline-flex items-center gap-1 p-1 bg-slate-200/75 dark:bg-slate-800 rounded-lg"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'send'}
                  onClick={() => setMode('send')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    mode === 'send'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Receive a file
                </button>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 transition-colors duration-150">
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
