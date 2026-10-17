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
  SlidersHorizontal,
  Eye,
  AlertCircle,
  Sparkles,
  Loader2
} from 'lucide-react';
import {
  SubtitleSegment,
  toReadableTime,
  generateSrtContent,
  generateTxtContent,
  generateVttContent,
  downloadFile,
  autoCalibrateSegments,
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
  preferredModel = 'gemini-3.8-flash',
}: SubtitleEditorProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRawSrt, setShowRawSrt] = useState(false);
  const [showShiftControls, setShowShiftControls] = useState(false);
  const [refiningIndex, setRefiningIndex] = useState<number | null>(null);
  const [calibratedNotice, setCalibratedNotice] = useState<string | null>(null);

  const handleAutoCalibrate = () => {
    const calibrated = autoCalibrateSegments(segments);
    onUpdateSegments(calibrated);
    setCalibratedNotice('បានតម្រឹមកាលវិភាគ SRT 100% ជោគជ័យ! លុបបំបាត់ការជាន់គ្នា និងរៀបតាមលំដាប់យ៉ាងត្រឹមត្រូវ។');
    setTimeout(() => setCalibratedNotice(null), 5000);
  };

  const handleNudgeSegment = (index: number, field: 'start' | 'end', delta: number) => {
    const seg = segments[index];
    if (!seg) return;
    if (field === 'start') {
      const newStart = Math.max(0, Math.round((seg.start + delta) * 100) / 100);
      const newEnd = Math.max(newStart + 0.3, seg.end);
      handleUpdateSegment(index, { start: newStart, end: newEnd });
    } else {
      const newEnd = Math.max(seg.start + 0.3, Math.round((seg.end + delta) * 100) / 100);
      handleUpdateSegment(index, { end: newEnd });
    }
  };

  const seekVideo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, time);
    }
  };

  const handleRefineSegment = async (index: number) => {
    const seg = segments[index];
    if (!seg) return;

    setRefiningIndex(index);
    const customApiKey =
      (typeof window !== 'undefined' ? localStorage.getItem('byok_gemini_api_key') : '') || '';
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
      } else {
        alert(data?.error || 'មិនអាចកែសម្រួលដោយ AI បានទេ។ សូមពិនិត្យមើល API Key របស់អ្នក។');
      }
    } catch (e) {
      console.error('Refine error:', e);
      alert('មានបញ្ហាក្នុងការភ្ជាប់ទៅកាន់ AI។ សូមព្យាយាមម្តងទៀត។');
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
      console.error(e);
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
    <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-[0_0_40px_rgba(0,0,0,0.7)] p-5 sm:p-7 relative overflow-hidden text-slate-100">
      {/* Subtle corner cyber glows */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800 relative z-10">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white font-black text-xs flex items-center justify-center shadow-[0_0_14px_rgba(217,70,239,0.5)]">
            ២
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              កែសម្រួលអត្ថបទ SRT (Subtitle & Dubbing Editor)
            </h2>
            <p className="text-xs text-slate-400">
              មាន {segments.length} ផ្នែក • អ្នកអាចស្តាប់ផ្ទៀងផ្ទាត់ និងកែប្រែពាក្យមុនពេលទាញយក
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAutoCalibrate}
            className="px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-lg inline-flex items-center gap-1.5 shadow-[0_0_16px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
            title="ពិនិត្យ និងតម្រឹមកាលវិភាគ 100% ដោយស្វ័យប្រវត្តិ គ្មានជាន់គ្នា"
          >
            <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
            <span>តម្រឹមកាលវិភាគ 100%</span>
          </button>

          <button
            type="button"
            onClick={() => setShowShiftControls(!showShiftControls)}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg inline-flex items-center gap-1 transition-all cursor-pointer shadow-xs"
            title="រំកិលពេលវេលាទាំងអស់ឱ្យត្រូវគ្នា (Sync Offset)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            <span>រំកិលពេលវេលា</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRawSrt(!showRawSrt)}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg inline-flex items-center gap-1 transition-all cursor-pointer shadow-xs"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>{showRawSrt ? 'លាក់កូដ SRT' : 'មើលកូដ SRT'}</span>
          </button>
        </div>
      </div>

      {/* Success Calibrated Notice */}
      {calibratedNotice && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between gap-2 relative z-10 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{calibratedNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setCalibratedNotice(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs cursor-pointer font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Warning Alert if any */}
      {warningNotice && !calibratedNotice && (
        <div className="mt-4 p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 text-xs flex items-start gap-2 relative z-10 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
          <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span>{warningNotice}</span>
        </div>
      )}

      {/* Shift Timestamps Bar */}
      {showShiftControls && (
        <div className="mt-4 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-1.5 text-slate-300 font-medium">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            <span>រំកិលពេលវេលាទាំងអស់ (Sync Offset):</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[-1.0, -0.5, -0.2, -0.1, 0.1, 0.2, 0.5, 1.0].map((shiftVal) => (
              <button
                key={shiftVal}
                type="button"
                onClick={() => handleApplyShift(shiftVal)}
                className="px-2 py-1 bg-slate-900 border border-slate-700 hover:border-cyan-400 hover:bg-cyan-950/60 rounded-lg text-cyan-300 font-mono text-xs cursor-pointer transition-all shadow-xs"
              >
                {shiftVal > 0 ? `+${shiftVal.toFixed(1)}s` : `${shiftVal.toFixed(1)}s`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Raw SRT Preview Panel */}
      {showRawSrt && (
        <div className="mt-4 p-4 rounded-2xl bg-black/90 text-cyan-300 font-mono text-xs max-h-60 overflow-y-auto border border-slate-800 relative z-10 shadow-inner">
          <pre className="whitespace-pre-wrap">{generateSrtContent(segments)}</pre>
        </div>
      )}

      {/* Search Bar */}
      <div className="mt-4 relative z-10">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ស្វែងរកពាក្យក្នុងអត្ថបទខ្មែរ ឬភាសាដើម..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 font-sans shadow-inner"
        />
      </div>

      {/* Segments List */}
      <div className="mt-4 space-y-3.5 max-h-[620px] overflow-y-auto pr-1 relative z-10">
        {filteredSegments.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-slate-950/70 rounded-2xl border border-slate-800">
            រកមិនឃើញអត្ថបទដែលត្រូវនឹងពាក្យស្វែងរក &quot;{searchQuery}&quot; ឡើយ។
          </div>
        ) : (
          filteredSegments.map((segment, index) => {
            const duration = Math.max(0, segment.end - segment.start).toFixed(2);
            const isActive =
              currentVideoTime >= segment.start && currentVideoTime <= segment.end;

            return (
              <div
                key={segment.id || index}
                className={`p-4 rounded-2xl border transition-all ${
                  isActive
                    ? 'border-cyan-400 bg-slate-950 ring-1 ring-cyan-400/50 shadow-[0_0_22px_rgba(6,182,212,0.35)]'
                    : 'border-slate-800/90 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-950/80'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-slate-900 border border-slate-700 text-cyan-300 text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => seekVideo(segment.start)}
                      className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 font-mono hover:underline cursor-pointer flex items-center gap-1"
                      title="ចុចដើម្បីលោតវីដេអូមកកាន់ពេលនេះ"
                    >
                      <span>{toReadableTime(segment.start)} → {toReadableTime(segment.end)}</span>
                    </button>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                      {duration}s
                    </span>
                    {isActive && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-bold animate-pulse">
                        កំពុងលេង
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => playSegment(segment.start, segment.end)}
                      className="px-2.5 py-1 text-xs font-semibold bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/40 rounded-lg inline-flex items-center gap-1 transition-all cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                      title="ស្តាប់ផ្នែកនេះក្នុងវីដេអូ"
                    >
                      <Play className="w-3 h-3 fill-current text-cyan-400" />
                      <span>លេងផ្នែកនេះ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteSegment(index)}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      title="លុបផ្នែកនេះ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Time inputs with fine-tuning nudge buttons */}
                <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400 font-medium">ចាប់ផ្ដើម (វិនាទី)</label>
                      {videoRef.current && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateSegment(index, {
                              start: Math.round(currentVideoTime * 100) / 100,
                            })
                          }
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer font-medium"
                        >
                          យកពេលវីដេអូ ({currentVideoTime.toFixed(1)}s)
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
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
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-cyan-200 font-mono text-xs focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30"
                      />
                      <button
                        type="button"
                        onClick={() => handleNudgeSegment(index, 'start', -0.1)}
                        className="px-1.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-cyan-400 font-mono border border-slate-700 shrink-0 cursor-pointer"
                        title="ថយក្រោយ ០.១ វិនាទី"
                      >
                        -0.1s
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNudgeSegment(index, 'start', 0.1)}
                        className="px-1.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-cyan-400 font-mono border border-slate-700 shrink-0 cursor-pointer"
                        title="ទៅមុខ ០.១ វិនាទី"
                      >
                        +0.1s
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400 font-medium">បញ្ចប់ (វិនាទី)</label>
                      {videoRef.current && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateSegment(index, {
                              end: Math.round(currentVideoTime * 100) / 100,
                            })
                          }
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer font-medium"
                        >
                          យកពេលវីដេអូ ({currentVideoTime.toFixed(1)}s)
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
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
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-cyan-200 font-mono text-xs focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30"
                      />
                      <button
                        type="button"
                        onClick={() => handleNudgeSegment(index, 'end', -0.1)}
                        className="px-1.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-cyan-400 font-mono border border-slate-700 shrink-0 cursor-pointer"
                        title="ថយក្រោយ ០.១ វិនាទី"
                      >
                        -0.1s
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNudgeSegment(index, 'end', 0.1)}
                        className="px-1.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-cyan-400 font-mono border border-slate-700 shrink-0 cursor-pointer"
                        title="ទៅមុខ ០.១ វិនាទី"
                      >
                        +0.1s
                      </button>
                    </div>
                  </div>
                </div>

                {/* Khmer text textarea */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      អត្ថបទខ្មែរ (Khmer Dubbing & Subtitle)
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRefineSegment(index)}
                      disabled={refiningIndex === index}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200 bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-500/40 px-2 py-0.5 rounded-md transition-all cursor-pointer shadow-[0_0_10px_rgba(99,102,241,0.25)]"
                      title="កែសម្រួលពាក្យដោយ AI ឱ្យកាន់តែរលូន"
                    >
                      {refiningIndex === index ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-indigo-300" />
                          <span>កំពុងកែសម្រួល...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 text-indigo-400" />
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
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-sm leading-relaxed focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 font-sans shadow-inner"
                  />
                </div>

                {/* Original language details */}
                {segment.original && (
                  <details className="text-xs group">
                    <summary className="text-slate-400 hover:text-slate-300 cursor-pointer select-none flex items-center gap-1 font-medium text-[11px]">
                      <span>មើលអត្ថបទភាសាដើម</span>
                    </summary>
                    <p className="mt-1.5 p-2 rounded-lg bg-slate-900/80 text-slate-300 text-xs italic border border-slate-800">
                      {segment.original}
                    </p>
                  </details>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add segment button */}
      <button
        type="button"
        onClick={() => handleAddSegment()}
        className="w-full mt-4 py-3 px-4 border border-dashed border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/40 rounded-xl text-xs font-bold text-cyan-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.15)] relative z-10"
      >
        <Plus className="w-4 h-4 text-cyan-400" />
        <span>បន្ថែមអត្ថបទថ្មី (Add Subtitle Segment)</span>
      </button>

      {/* Action / Export Buttons */}
      <div className="mt-6 pt-5 border-t border-slate-800 relative z-10">
        <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-3">
          ទាញយកឯកសារ (Download & Export)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <button
            type="button"
            onClick={handleDownloadSrt}
            className="w-full py-3 px-3 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-300/30 transition-all cursor-pointer active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>ទាញយក SRT (.srt)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTxt}
            className="w-full py-3 px-3 bg-slate-950 hover:bg-slate-900 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.2)] transition-all cursor-pointer active:scale-[0.98]"
          >
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>ទាញយក TXT (.txt)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadVtt}
            className="w-full py-3 px-3 bg-slate-950 hover:bg-slate-900 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(168,85,247,0.2)] transition-all cursor-pointer"
          >
            <FileCode className="w-4 h-4 text-purple-400" />
            <span>ទាញយក WebVTT (.vtt)</span>
          </button>

          <button
            type="button"
            onClick={handleCopySrt}
            className="w-full py-3 px-3 bg-slate-950 hover:bg-slate-900 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.2)] transition-all cursor-pointer"
          >
            {copiedType === 'srt' ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300 font-bold">បានចម្លង SRT!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-emerald-400" />
                <span>ចម្លងកូដ SRT</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyTxt}
            className="w-full py-3 px-3 bg-slate-950 hover:bg-slate-900 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.2)] transition-all cursor-pointer"
          >
            {copiedType === 'txt' ? (
              <>
                <Check className="w-4 h-4 text-amber-400" />
                <span className="text-amber-300 font-bold">បានចម្លង TXT!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-amber-400" />
                <span>ចម្លងអត្ថបទ TXT</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
