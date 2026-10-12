import React, { useState } from 'react';
import {
  Play,
  Trash2,
  Plus,
  Download,
  FileText,
  FileCode,
  Copy,
  Check,
  Search,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Eye,
  SlidersHorizontal,
  RefreshCw,
  Sparkles,
  Loader2
} from 'lucide-react';
import {
  SubtitleSegment,
  toSrtTimestamp,
  toReadableTime,
  generateSrtContent,
  generateTxtContent,
  generateVttContent,
  downloadFile,
  cleanTextForVoiceRTool,
  generateVoiceRToolSrt,
  generateVoiceRToolScript
} from '../utils/subtitleUtils';

interface SubtitleEditorProps {
  segments: SubtitleSegment[];
  onUpdateSegments: (newSegments: SubtitleSegment[]) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentVideoTime: number;
  fileName?: string;
  warningNotice?: string;
  preferredModel?: string;
}

export function SubtitleEditor({
  segments,
  onUpdateSegments,
  videoRef,
  currentVideoTime,
  fileName,
  warningNotice,
  preferredModel = 'gemini-2.5-flash',
}: SubtitleEditorProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRawSrt, setShowRawSrt] = useState(false);
  const [shiftAmount, setShiftAmount] = useState<number>(0);
  const [showShiftControls, setShowShiftControls] = useState(false);
  const [refiningIndex, setRefiningIndex] = useState<number | null>(null);

  const handleRefineSegment = async (index: number) => {
    const seg = segments[index];
    if (!seg) return;

    setRefiningIndex(index);
    const customApiKey = (typeof window !== 'undefined' ? localStorage.getItem('byok_gemini_api_key') : '') || '';
    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customApiKey,
          text: seg.text,
          original: seg.original,
          model: preferredModel,
        }),
      });
      const data = await res.json();
      if (res.ok && data.refined) {
        handleUpdateSegment(index, { text: data.refined });
      }
    } catch (e) {
      console.error('Refine error:', e);
    } finally {
      setRefiningIndex(null);
    }
  };

  // Play specific segment on video
  const playSegment = (start: number, end: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, start);
      videoRef.current.play();

      const checkTime = () => {
        if (videoRef.current && videoRef.current.currentTime >= end) {
          videoRef.current.pause();
          videoRef.current.removeEventListener('timeupdate', checkTime);
        }
      };
      videoRef.current.addEventListener('timeupdate', checkTime);
    }
  };

  const handleUpdateSegment = (index: number, updated: Partial<SubtitleSegment>) => {
    const updatedList = [...segments];
    updatedList[index] = { ...updatedList[index], ...updated };
    onUpdateSegments(updatedList);
  };

  const handleDeleteSegment = (index: number) => {
    const updatedList = segments.filter((_, i) => i !== index);
    onUpdateSegments(updatedList);
  };

  const handleAddSegment = (afterIndex?: number) => {
    const lastSeg = segments[segments.length - 1];
    let start = 0;
    let end = 2.5;

    if (typeof afterIndex === 'number' && segments[afterIndex]) {
      start = Math.round((segments[afterIndex].end + 0.1) * 100) / 100;
      end = Math.round((start + 2.5) * 100) / 100;
    } else if (lastSeg) {
      start = Math.round((lastSeg.end + 0.2) * 100) / 100;
      end = Math.round((start + 2.5) * 100) / 100;
    }

    const newSegment: SubtitleSegment = {
      id: segments.length + 1,
      start,
      end,
      original: '',
      text: '',
    };

    if (typeof afterIndex === 'number') {
      const copy = [...segments];
      copy.splice(afterIndex + 1, 0, newSegment);
      onUpdateSegments(copy);
    } else {
      onUpdateSegments([...segments, newSegment]);
    }
  };

  const handleApplyShift = (delta: number) => {
    const shifted = segments.map((s) => ({
      ...s,
      start: Math.max(0, Math.round((s.start + delta) * 100) / 100),
      end: Math.max(0.1, Math.round((s.end + delta) * 100) / 100),
    }));
    onUpdateSegments(shifted);
  };

  const handleDownloadSrt = () => {
    try {
      const content = generateSrtContent(segments);
      const base = fileName ? fileName.replace(/\.[^.]+$/, '') : 'subtitles';
      downloadFile(`${base}-khmer.srt`, content, 'application/x-subrip');
    } catch (e: any) {
      alert(e.message || 'មិនអាចទាញយកបានទេ។');
    }
  };

  const handleDownloadTxt = () => {
    const content = generateTxtContent(segments, false);
    const base = fileName ? fileName.replace(/\.[^.]+$/, '') : 'dubbing-script';
    downloadFile(`${base}-khmer.txt`, content, 'text/plain');
  };

  const handleDownloadVtt = () => {
    const content = generateVttContent(segments);
    const base = fileName ? fileName.replace(/\.[^.]+$/, '') : 'subtitles';
    downloadFile(`${base}-khmer.vtt`, content, 'text/vtt');
  };

  const handleCopySrt = async () => {
    const content = generateSrtContent(segments);
    await navigator.clipboard.writeText(content);
    setCopiedType('srt');
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyTxt = async () => {
    const content = generateTxtContent(segments, false);
    await navigator.clipboard.writeText(content);
    setCopiedType('txt');
    setTimeout(() => setCopiedType(null), 2000);
  };

  const filteredSegments = searchQuery.trim()
    ? segments.filter(
        (s) =>
          s.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.original.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : segments;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
            ២
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              កែសម្រួលអត្ថបទ SRT (Subtitle & Dubbing Editor)
            </h2>
            <p className="text-xs text-slate-500">
              មាន {segments.length} ផ្នែក • អ្នកអាចស្តាប់ផ្ទៀងផ្ទាត់ និងកែប្រែពាក្យមុនពេលទាញយក
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowShiftControls(!showShiftControls)}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
            title="រុញពេលវេលាទាំងអស់ឱ្យត្រូវគ្នា"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>កែសម្រួលល្បឿន</span>
          </button>

          <button
            onClick={() => setShowRawSrt(!showRawSrt)}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            <span>{showRawSrt ? 'លាក់កូដ SRT' : 'មើលកូដ SRT'}</span>
          </button>
        </div>
      </div>

      {/* Warning Alert if any */}
      {warningNotice && (
        <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{warningNotice}</span>
        </div>
      )}

      {/* Shift Timestamps Bar */}
      {showShiftControls && (
        <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3">
          <span className="text-slate-600 font-medium">
            រំកិលពេលវេលាទាំងអស់ (Sync Offset):
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleApplyShift(-1.0)}
              className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-mono text-xs cursor-pointer"
            >
              -1.0s
            </button>
            <button
              onClick={() => handleApplyShift(-0.5)}
              className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-mono text-xs cursor-pointer"
            >
              -0.5s
            </button>
            <button
              onClick={() => handleApplyShift(0.5)}
              className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-mono text-xs cursor-pointer"
            >
              +0.5s
            </button>
            <button
              onClick={() => handleApplyShift(1.0)}
              className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-mono text-xs cursor-pointer"
            >
              +1.0s
            </button>
          </div>
        </div>
      )}

      {/* Raw SRT Preview Panel */}
      {showRawSrt && (
        <div className="mt-4 p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs max-h-60 overflow-y-auto border border-slate-800">
          <pre className="whitespace-pre-wrap">{generateSrtContent(segments)}</pre>
        </div>
      )}

      {/* Search Bar */}
      <div className="mt-4 relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ស្វែងរកពាក្យក្នុងអត្ថបទខ្មែរ ឬភាសាដើម..."
          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
        />
      </div>

      {/* Segments List */}
      <div className="mt-4 space-y-3.5 max-h-[620px] overflow-y-auto pr-1">
        {filteredSegments.map((segment, index) => {
          const duration = Math.max(0, segment.end - segment.start).toFixed(2);
          const isActive =
            currentVideoTime >= segment.start && currentVideoTime <= segment.end;

          return (
            <div
              key={segment.id || index}
              className={`p-4 rounded-xl border transition-all ${
                isActive
                  ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-600">
                    {toReadableTime(segment.start)} → {toReadableTime(segment.end)}
                  </span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                    {duration}s
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => playSegment(segment.start, segment.end)}
                    className="px-2.5 py-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                    title="ស្តាប់ផ្នែកនេះក្នុងវីដេអូ"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>លេងផ្នែកនេះ</span>
                  </button>

                  <button
                    onClick={() => handleDeleteSegment(index)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="លុបផ្នែកនេះ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Time inputs */}
              <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-500 font-medium">ចាប់ផ្ដើម (វិនាទី)</label>
                    {videoRef.current && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSegment(index, {
                            start: Math.round(currentVideoTime * 100) / 100,
                          })
                        }
                        className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                      >
                        យកពេលវីដេអូ ({currentVideoTime.toFixed(1)}s)
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={segment.start}
                    onChange={(e) =>
                      handleUpdateSegment(index, {
                        start: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-500 font-medium">បញ្ចប់ (វិនាទី)</label>
                    {videoRef.current && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSegment(index, {
                            end: Math.round(currentVideoTime * 100) / 100,
                          })
                        }
                        className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                      >
                        យកពេលវីដេអូ ({currentVideoTime.toFixed(1)}s)
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={segment.end}
                    onChange={(e) =>
                      handleUpdateSegment(index, {
                        end: Math.max(segment.start + 0.1, Number(e.target.value)),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Khmer text textarea */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    អត្ថបទខ្មែរ (Khmer Dubbing & Subtitle)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRefineSegment(index)}
                    disabled={refiningIndex === index}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                    title="កែសម្រួលពាក្យដោយ AI ឱ្យកាន់តែរលូន"
                  >
                    {refiningIndex === index ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                        <span>កំពុងកែសម្រួល...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        <span>កែលម្អដោយ AI</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={segment.text}
                  onChange={(e) => handleUpdateSegment(index, { text: e.target.value })}
                  placeholder="សរសេរ ឬកែសម្រួលអត្ថបទខ្មែរ..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans shadow-2xs"
                />
              </div>

              {/* Original language details */}
              {segment.original && (
                <details className="text-xs group">
                  <summary className="text-slate-500 hover:text-slate-700 cursor-pointer select-none flex items-center gap-1 font-medium">
                    <span>មើលអត្ថបទភាសាដើម</span>
                  </summary>
                  <p className="mt-1.5 p-2 rounded-lg bg-slate-50 text-slate-700 text-xs italic border border-slate-200/70">
                    {segment.original}
                  </p>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {/* Add segment button */}
      <button
        onClick={() => handleAddSegment()}
        className="w-full mt-4 py-2.5 px-4 border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/50 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span>បន្ថែមអត្ថបទថ្មី (Add Subtitle Segment)</span>
      </button>

      {/* Action / Export Buttons */}
      <div className="mt-6 pt-5 border-t border-slate-100">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          ទាញយកឯកសារ (Download & Export)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <button
            onClick={handleDownloadSrt}
            className="w-full py-3 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>ទាញយក SRT (.srt)</span>
          </button>

          <button
            onClick={handleDownloadTxt}
            className="w-full py-3 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-[0.98]"
          >
            <FileText className="w-4 h-4" />
            <span>ទាញយក TXT (.txt)</span>
          </button>

          <button
            onClick={handleDownloadVtt}
            className="w-full py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <FileCode className="w-4 h-4 text-slate-600" />
            <span>ទាញយក WebVTT (.vtt)</span>
          </button>

          <button
            onClick={handleCopySrt}
            className="w-full py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            {copiedType === 'srt' ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">បានចម្លង!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-600" />
                <span>ចម្លងកូដ SRT</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
