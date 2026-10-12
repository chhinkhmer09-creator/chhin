import React, { useEffect, useState } from 'react';
import { Film, Sparkles, CheckCircle2, AlertCircle, Key } from 'lucide-react';

interface HeaderProps {
  onOpenApiKeyModal?: () => void;
}

export function Header({ onOpenApiKeyModal }: HeaderProps = {}) {
  const [apiStatus, setApiStatus] = useState<{ checked: boolean; ok: boolean }>({
    checked: false,
    ok: false,
  });

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setApiStatus({ checked: true, ok: Boolean(data.apiConfigured) });
      })
      .catch(() => {
        setApiStatus({ checked: true, ok: false });
      });
  }, []);

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 py-3 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
                Khmer Video to SRT
              </h1>
              <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-200/60">
                AI Dub Studio
              </span>
            </div>
            <p className="text-xs text-slate-500">
              បម្លែងវីដេអូទៅជាចំណងជើងរង SRT ភាសាខ្មែរ និងអត្ថបទបញ្ចូលសំឡេង VoiceRTool
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {onOpenApiKeyModal && (
            <button
              type="button"
              onClick={onOpenApiKeyModal}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-full font-bold transition-colors cursor-pointer"
              title="ការកំណត់បញ្ចូល API Key"
            >
              <Key className="w-3.5 h-3.5 text-amber-600" />
              <span>⚙️ API Key</span>
            </button>
          )}

          {apiStatus.checked && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                apiStatus.ok
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {apiStatus.ok ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Gemini AI ភ្ជាប់រួចរាល់</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>កំពុងរង់ចាំ GEMINI_API_KEY</span>
                </>
              )}
            </div>
          )}

          <a
            href="https://voicertool.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-medium transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>VoiceRTool</span>
          </a>
        </div>
      </div>
    </header>
  );
}
