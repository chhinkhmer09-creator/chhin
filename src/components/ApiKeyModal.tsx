import React, { useState, useEffect } from 'react';
import {
  Key,
  X,
  Cpu,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Trash2,
  Check,
  Eye,
  EyeOff,
  Zap,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyChanged?: (key: string) => void;
}

export function ApiKeyModal({ isOpen, onClose, onKeyChanged }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasCustomKey, setHasCustomKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('3.8 Flash');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latency?: number;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('byok_gemini_api_key') || '';
      if (stored) {
        setApiKey(stored);
        setHasCustomKey(true);
      } else {
        setHasCustomKey(false);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem('byok_gemini_api_key', trimmed);
      setHasCustomKey(true);
      onKeyChanged?.(trimmed);
      setSaveSuccess(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('byok-key-updated'));
      }
      setTimeout(() => setSaveSuccess(false), 2500);
    } else {
      handleDeleteKey();
    }
  };

  const handleDeleteKey = () => {
    localStorage.removeItem('byok_gemini_api_key');
    setApiKey('');
    setHasCustomKey(false);
    onKeyChanged?.('');
    setTestResult(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('byok-key-updated'));
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const keyToTest = apiKey.trim() || (typeof window !== 'undefined' ? localStorage.getItem('byok_gemini_api_key') : '') || '';

    try {
      const res = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customApiKey: keyToTest,
          model: selectedModel,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setTestResult({
          success: true,
          message: data.message || `ការតភ្ជាប់ជោគជ័យ 100%! ល្បឿនឆ្លើយតប: ${(data.latency / 1000).toFixed(2)}s`,
          latency: data.latency,
        });
      } else {
        throw new Error(data.error || 'ការតភ្ជាប់បរាជ័យ');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'មិនអាចភ្ជាប់ទៅកាន់ Gemini API បានទេ។',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="bg-slate-950/95 text-slate-100 rounded-3xl max-w-[500px] w-full p-5 sm:p-7 shadow-[0_0_50px_rgba(0,0,0,0.9)] border border-slate-800 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Key className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  ការកំណត់បញ្ចូល API Key
                </h3>
                <span className="text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  BYOK
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                អ្នកអាចប្រើប្រាស់ Google Gemini API Key ផ្ទាល់ខ្លួនរបស់អ្នក ឬប្រើប្រាស់ Default Key
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current status bar */}
        <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>ស្ថានភាពបច្ចុប្បន្ន៖</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span>
              {hasCustomKey
                ? 'Custom API Key ផ្ទាល់ខ្លួន (ដំណើរការស្រាប់)'
                : 'Default System Key (ដំណើរការស្រាប់)'}
            </span>
          </div>
        </div>

        {/* Input label row with top test button */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-200">
              បញ្ចូល Gemini API Key របស់អ្នក (Google AI Studio)
            </label>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.2)]"
            >
              {isTesting ? (
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              ) : (
                <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
              )}
              <span>សាកល្បង</span>
            </button>
          </div>

          {/* Password Input with show/hide toggle */}
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="••••••••••••••••••••••••••••••••"
              className="w-full bg-slate-900 border-2 border-amber-500/50 rounded-2xl py-2.5 pl-3.5 pr-10 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 shadow-inner"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              title={showKey ? 'លាក់ Key' : 'បង្ហាញ Key'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Supported Models Section */}
        <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 mb-4">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>ម៉ូឌែលដែលគាំទ្រ (Supported Models):</span>
            </div>
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              ដំណើរការ 100%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {/* 3.1 Pro */}
            <div
              onClick={() => setSelectedModel('3.1 Pro')}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer relative ${
                selectedModel === '3.1 Pro'
                  ? 'border-2 border-amber-400 bg-amber-950/30 ring-1 ring-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
              }`}
            >
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-tighter">
                PRO
              </span>
              <h4 className="text-xs font-bold text-purple-400 mt-0.5">3.1 Pro</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">ស៊ីជម្រៅបំផុត</p>
            </div>

            {/* 3.8 Flash (Active highlight) */}
            <div
              onClick={() => setSelectedModel('3.8 Flash')}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer relative ${
                selectedModel === '3.8 Flash'
                  ? 'border-2 border-amber-400 bg-amber-950/30 ring-1 ring-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
              }`}
            >
              <h4 className="text-xs font-bold text-cyan-400">3.8 Flash</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">ឆ្លាតវៃបំផុត</p>
            </div>

            {/* 3.1 Flash */}
            <div
              onClick={() => setSelectedModel('3.1 Flash')}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer relative ${
                selectedModel === '3.1 Flash'
                  ? 'border-2 border-amber-400 bg-amber-950/30 ring-1 ring-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
              }`}
            >
              <h4 className="text-xs font-bold text-emerald-400">3.1 Flash</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">លឿនរហ័ស</p>
            </div>
          </div>
        </div>

        {/* Security & Storage Notice */}
        <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 mb-4 space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>សុវត្ថិភាព និងការរក្សាទុក</span>
          </div>
          <p className="text-[11px] text-amber-200/80 leading-relaxed">
            API Key របស់អ្នកត្រូវបានរក្សាទុកតែនៅក្នុង Browser (localStorage) នៃឧបករណ៍របស់អ្នកផ្ទាល់ប៉ុណ្ណោះ មិនត្រូវបានចែករំលែកឡើយ។
          </p>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:underline pt-0.5"
          >
            <span>👉 របៀបបង្កើត Gemini API Key ឥតគិតថ្លៃនៅ Google AI Studio</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Test Result Feedback Banner */}
        {testResult && (
          <div
            className={`p-2.5 rounded-xl mb-3 text-xs flex items-start gap-2 border ${
              testResult.success
                ? 'bg-emerald-950/70 text-emerald-200 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-rose-950/70 text-rose-200 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <span className="font-semibold text-[11px] leading-tight">
              {testResult.message}
            </span>
          </div>
        )}

        {saveSuccess && (
          <div className="p-2 rounded-xl mb-3 bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-1.5 font-bold shadow-[0_0_12px_rgba(16,185,129,0.2)]">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>បានរក្សាទុក API Key ជោគជ័យ!</span>
          </div>
        )}

        {/* Bottom Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
          {/* Delete custom key */}
          <button
            type="button"
            onClick={handleDeleteKey}
            className="px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl text-xs font-bold border border-rose-500/30 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>លុប Custom Key</span>
          </button>

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Bottom test button */}
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.2)]"
            >
              {isTesting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              )}
              <span>សាកល្បង</span>
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl transition-colors cursor-pointer"
            >
              បិទ
            </button>

            {/* Save API Key button in orange */}
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-500/25 flex items-center gap-1.5 transition-all cursor-pointer border border-amber-300/30"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>រក្សាទុក API Key</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
