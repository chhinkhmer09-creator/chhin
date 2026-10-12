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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white rounded-3xl max-w-[500px] w-full p-5 sm:p-7 shadow-2xl border border-slate-200 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching screenshot 100% */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/25">
              <Key className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  ការកំណត់បញ្ចូល API Key
                </h3>
                <span className="text-[11px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  BYOK
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                អ្នកអាចប្រើប្រាស់ Google Gemini API Key ផ្ទាល់ខ្លួនរបស់អ្នក ឬប្រើប្រាស់ Default Key
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current status bar matching screenshot */}
        <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Cpu className="w-4 h-4 text-blue-600" />
            <span>ស្ថានភាពបច្ចុប្បន្ន៖</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
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
            <label className="text-xs font-bold text-slate-800">
              បញ្ចូល Gemini API Key របស់អ្នក (Google AI Studio)
            </label>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              {isTesting ? (
                <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
              ) : (
                <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
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
              className="w-full bg-white border-2 border-amber-300/80 rounded-2xl py-2.5 pl-3.5 pr-10 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-2xs"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              title={showKey ? 'លាក់ Key' : 'បង្ហាញ Key'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Supported Models Section matching screenshot */}
        <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 mb-4">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>ម៉ូឌែលដែលគាំទ្រ (Supported Models):</span>
            </div>
            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              ដំណើរការ 100%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {/* 3.1 Pro */}
            <div
              onClick={() => setSelectedModel('3.1 Pro')}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer relative bg-white ${
                selectedModel === '3.1 Pro'
                  ? 'border-2 border-amber-400 ring-2 ring-amber-400/20 shadow-xs'
                  : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-tighter">
                PRO
              </span>
              <h4 className="text-xs font-bold text-purple-700 mt-0.5">3.1 Pro</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">ស៊ីជម្រៅបំផុត</p>
            </div>

            {/* 3.8 Flash (Active highlight) */}
            <div
              onClick={() => setSelectedModel('3.8 Flash')}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer relative bg-white ${
                selectedModel === '3.8 Flash'
                  ? 'border-2 border-amber-400 ring-2 ring-amber-400/20 shadow-xs'
                  : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <h4 className="text-xs font-bold text-blue-600">3.8 Flash</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">ឆ្លាតវៃបំផុត</p>
            </div>

            {/* 3.1 Flash */}
            <div
              onClick={() => setSelectedModel('3.1 Flash')}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer relative bg-white ${
                selectedModel === '3.1 Flash'
                  ? 'border-2 border-amber-400 ring-2 ring-amber-400/20 shadow-xs'
                  : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <h4 className="text-xs font-bold text-emerald-600">3.1 Flash</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">លឿនរហ័ស</p>
            </div>
          </div>
        </div>

        {/* Security & Storage Notice matching screenshot */}
        <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 mb-4 space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-amber-900">
            <ShieldCheck className="w-4 h-4 text-amber-700" />
            <span>សុវត្ថិភាព និងការរក្សាទុក</span>
          </div>
          <p className="text-[11px] text-amber-950/80 leading-relaxed">
            API Key របស់អ្នកត្រូវបានរក្សាទុកតែនៅក្នុង Browser (localStorage) នៃឧបករណ៍របស់អ្នកផ្ទាល់ប៉ុណ្ណោះ មិនត្រូវបានចែករំលែកឡើយ។
          </p>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline pt-0.5"
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
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span className="font-semibold text-[11px] leading-tight">
              {testResult.message}
            </span>
          </div>
        )}

        {saveSuccess && (
          <div className="p-2 rounded-xl mb-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>បានរក្សាទុក API Key ជោគជ័យ!</span>
          </div>
        )}

        {/* Bottom Actions Row matching screenshot 100% */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          {/* Delete custom key */}
          <button
            type="button"
            onClick={handleDeleteKey}
            className="px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold border border-rose-200 flex items-center gap-1 transition-colors cursor-pointer"
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
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              {isTesting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              )}
              <span>សាកល្បង</span>
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              បិទ
            </button>

            {/* Save API Key button in orange */}
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
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
