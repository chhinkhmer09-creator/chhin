import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, Key } from 'lucide-react';
import { AppLogo } from './AppLogo';

interface HeaderProps {
  onOpenApiKeyModal?: () => void;
}

export function Header({ onOpenApiKeyModal }: HeaderProps = {}) {
  const [apiStatus, setApiStatus] = useState<{ checked: boolean; ok: boolean; isCustom: boolean }>({
    checked: false,
    ok: false,
    isCustom: false,
  });

  const checkStatus = useCallback(() => {
    const customKey = (typeof window !== 'undefined' ? localStorage.getItem('byok_gemini_api_key') : '') || '';

    fetch('/api/health', {
      headers: customKey ? { 'x-custom-api-key': customKey } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        const hasKey = Boolean(data.apiConfigured || customKey.trim().length > 5);
        setApiStatus({
          checked: true,
          ok: hasKey,
          isCustom: Boolean(customKey && customKey.trim().length > 5),
        });
      })
      .catch(() => {
        const hasLocalKey = Boolean(customKey && customKey.trim().length > 5);
        setApiStatus({ checked: true, ok: hasLocalKey, isCustom: hasLocalKey });
      });
  }, []);

  useEffect(() => {
    checkStatus();

    const handleKeyChange = () => {
      checkStatus();
    };

    window.addEventListener('storage', handleKeyChange);
    window.addEventListener('byok-key-updated', handleKeyChange);

    return () => {
      window.removeEventListener('storage', handleKeyChange);
      window.removeEventListener('byok-key-updated', handleKeyChange);
    };
  }, [checkStatus]);

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl sticky top-0 z-30 shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
      <div className="max-w-6xl mx-auto px-4 py-2.5 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <AppLogo size="sm" />

        <div className="flex items-center gap-2 text-xs">
          {onOpenApiKeyModal && (
            <button
              type="button"
              onClick={onOpenApiKeyModal}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 rounded-full font-bold transition-all cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.2)]"
              title="ការកំណត់បញ្ចូល API Key"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>⚙️ API Key</span>
            </button>
          )}

          {apiStatus.checked && (
            <button
              type="button"
              onClick={!apiStatus.ok && onOpenApiKeyModal ? onOpenApiKeyModal : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${
                apiStatus.ok
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)] font-semibold'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold hover:bg-amber-500/30 cursor-pointer animate-pulse shadow-[0_0_16px_rgba(245,158,11,0.35)]'
              }`}
              title={apiStatus.ok ? 'ការតភ្ជាប់ Gemini AI ដំណើរការ 100%' : 'ចុចទីនេះដើម្បីបញ្ចូល API Key'}
            >
              {apiStatus.ok ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Gemini AI ភ្ជាប់រួចរាល់ 100%</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>ចុចបញ្ចូល Gemini API Key</span>
                </>
              )}
            </button>
          )}

          <a
            href="https://voicertool.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1 bg-slate-900/90 hover:bg-cyan-950/60 text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 hover:border-cyan-400/50 rounded-full font-medium transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)]"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>VoiceRTool</span>
          </a>
        </div>
      </div>
    </header>
  );
}
