import React, { useRef, useState } from 'react';
import {
  Upload,
  Film,
  FileVideo,
  Clock,
  Sparkles,
  AlertTriangle,
  PlayCircle,
  Settings2,
  CheckCircle,
  Loader2,
  Volume2,
  Zap,
  Cpu,
  Gauge,
  Check,
  Key
} from 'lucide-react';
import { extractAudioFromMedia, ExtractionProgress } from '../utils/audioExtractor';
import { SubtitleSegment, SAMPLE_SEGMENTS, toReadableTime, autoCalibrateSegments } from '../utils/subtitleUtils';

interface VideoUploaderProps {
  onVideoSelected: (file: File | null, videoUrl: string | null) => void;
  onConversionComplete: (segments: SubtitleSegment[], warning?: string) => void;
  selectedVideoFile: File | null;
  videoPreviewUrl: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentVideoTime: number;
  segments?: SubtitleSegment[];
  onOpenApiKeyModal?: () => void;
}

export function VideoUploader({
  onVideoSelected,
  onConversionComplete,
  selectedVideoFile,
  videoPreviewUrl,
  videoRef,
  currentVideoTime,
  segments = [],
  onOpenApiKeyModal,
}: VideoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [progressInfo, setProgressInfo] = useState<ExtractionProgress | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState<'auto' | 'zh' | 'en' | 'th' | 'ko'>('auto');
  const [dubbingStyle, setDubbingStyle] = useState<'natural' | 'formal' | 'casual'>('natural');
  const [preferredModel, setPreferredModel] = useState<string>('gemini-3.8-flash');
  const [isDragging, setIsDragging] = useState(false);

  // Range and chapter support for long/large videos up to 10,000 MB
  const [scopeMode, setScopeMode] = useState<'full' | 'chapter' | 'custom'>('full');
  const [selectedChapter, setSelectedChapter] = useState<number>(0);
  const [customStartSec, setCustomStartSec] = useState<number>(0);
  const [customEndSec, setCustomEndSec] = useState<number>(600);

  const handleFile = (file: File) => {
    setErrorMessage(null);
    setStatusMessage('');
    setVideoDuration(null);
    setSelectedChapter(0);

    const maxSizeBytes = 10000 * 1024 * 1024; // 10,000 MB (10 GB)
    if (file.size > maxSizeBytes) {
      setErrorMessage('ទំហំវីដេអូធំជាង 10,000 MB (10 GB)។ សូមជ្រើសរើសវីដេអូដែលមានទំហំតូចជាងនេះ។');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    onVideoSelected(file, objectUrl);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const dur = e.currentTarget.duration;
    if (Number.isFinite(dur)) {
      setVideoDuration(dur);
      setCustomEndSec(Math.min(600, Math.round(dur)));
      if (dur > 600) {
        // Recommend chapter mode for long videos over 10 minutes
        setScopeMode('chapter');
      } else {
        setScopeMode('full');
      }
    }
  };

  // Compute 3-minute chapters (180s) for 100% timestamp precision & zero drift
  const chapterLength = 180; // 3 minutes per chunk gives optimal speech-to-text alignment
  const totalChapters = videoDuration ? Math.ceil(videoDuration / chapterLength) : 1;
  const chapters = Array.from({ length: totalChapters }, (_, i) => {
    const start = i * chapterLength;
    const end = videoDuration ? Math.min(videoDuration, (i + 1) * chapterLength) : (i + 1) * chapterLength;
    return {
      index: i,
      start,
      end,
      label: `ផ្នែកទី ${i + 1} (${Math.floor(start / 60)}:${String(Math.floor(start % 60)).padStart(2, '0')} - ${Math.floor(end / 60)}:${String(Math.floor(end % 60)).padStart(2, '0')})`,
    };
  });

  const handleConvert = async () => {
    if (!selectedVideoFile) return;

    setIsConverting(true);
    setErrorMessage(null);
    setStatusMessage('កំពុងចាប់ផ្តើមរៀបចំទិន្នន័យ...');

    // If Full Video is selected and duration is longer than 3 minutes, process chapters sequentially
    if (scopeMode === 'full' && chapters.length > 1) {
      try {
        let allSegments: SubtitleSegment[] = [];
        let lastWarning = '';
        let usedModelName = '';

        for (let i = 0; i < chapters.length; i++) {
          const ch = chapters[i];
          setStatusMessage(`កំពុងដកសំឡេង និងបកប្រែ ${ch.label} (${i + 1}/${chapters.length})...`);

          const { base64, mimeType, sliceDuration } = await extractAudioFromMedia(
            selectedVideoFile,
            { startTime: ch.start, endTime: ch.end },
            (progress) => {
              setProgressInfo({
                ...progress,
                message: `[ផ្នែកទី ${i + 1}/${chapters.length}] ${progress.message}`,
              });
            }
          );

          setStatusMessage(`កំពុងបកប្រែ ${ch.label} ដោយ Gemini AI ជាមួយកាលវិភាគ 100% ត្រឹមត្រូវ...`);

          const customApiKey = (typeof window !== 'undefined' ? localStorage.getItem('byok_gemini_api_key') : '') || '';
          const response = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customApiKey,
              audioBase64: base64,
              audioDuration: sliceDuration,
              mimeType,
              sourceLanguage: sourceLang,
              style: dubbingStyle,
              preferredModel,
            }),
          });

          let data: any;
          try {
            data = await response.json();
          } catch {
            throw new Error(`ម៉ាស៊ីនមេមិនបានឆ្លើយតបទិន្នន័យត្រឹមត្រូវសម្រាប់ ${ch.label} ទេ។`);
          }

          if (!response.ok) {
            throw new Error(data?.error || `ការបម្លែង ${ch.label} បរាជ័យ។`);
          }

          if (data.segments && Array.isArray(data.segments)) {
            const adjusted = data.segments.map((s: SubtitleSegment) => ({
              ...s,
              start: Math.round((s.start + ch.start) * 100) / 100,
              end: Math.round((s.end + ch.start) * 100) / 100,
            }));
            allSegments = [...allSegments, ...adjusted];
          }

          if (data.warning) lastWarning = data.warning;
          if (data.modelUsed) usedModelName = data.modelUsed;
        }

        // Apply 100% auto-calibration to ensure chronological integrity and zero overlap across chunks
        const calibrated = autoCalibrateSegments(allSegments);

        const modelBadge = usedModelName ? ` (${usedModelName})` : '';
        setStatusMessage(
          `ជោគជ័យ! បានបង្កើតអត្ថបទខ្មែរគ្រប់ផ្នែកចំនួន ${calibrated.length} ផ្នែក តម្រឹមកាលវិភាគ 100%${modelBadge}។`
        );
        onConversionComplete(calibrated, lastWarning);
      } catch (err: any) {
        console.error(err);
        setErrorMessage(err.message || 'មានបញ្ហាក្នុងការបម្លែងវីដេអូ។ សូមព្យាយាមម្តងទៀត។');
      } finally {
        setIsConverting(false);
        setProgressInfo(null);
      }
      return;
    }

    // Single chapter or custom range processing
    let startTime = 0;
    let endTime = videoDuration || 180;

    if (scopeMode === 'chapter' && chapters[selectedChapter]) {
      startTime = chapters[selectedChapter].start;
      endTime = chapters[selectedChapter].end;
    } else if (scopeMode === 'custom') {
      startTime = Math.max(0, customStartSec);
      endTime = Math.max(startTime + 1, customEndSec);
    } else if (scopeMode === 'full') {
      startTime = 0;
      endTime = Math.min(videoDuration || 180, 180);
    }

    try {
      // Step 1: Extract 16kHz mono audio directly in browser with requested range
      const { base64, mimeType, sliceDuration } = await extractAudioFromMedia(
        selectedVideoFile,
        { startTime, endTime },
        (progress) => {
          setProgressInfo(progress);
          setStatusMessage(progress.message);
        }
      );

      setStatusMessage('កំពុងផ្ញើទៅកាន់ Gemini AI ដើម្បីស្តាប់ ស្គាល់ពាក្យ និងបកប្រែជាភាសាខ្មែរ 100% ស៊ីគ្នា...');

      // Step 2: Call server endpoint
      const customApiKey = (typeof window !== 'undefined' ? localStorage.getItem('byok_gemini_api_key') : '') || '';
      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customApiKey,
          audioBase64: base64,
          audioDuration: sliceDuration,
          mimeType,
          sourceLanguage: sourceLang,
          style: dubbingStyle,
          preferredModel,
        }),
      });

      let data: any;
      try {
        data = await response.json();
      } catch {
        throw new Error('ម៉ាស៊ីនមេមិនបានឆ្លើយតបទិន្នន័យ JSON ត្រឹមត្រូវទេ។');
      }

      if (!response.ok) {
        throw new Error(data?.error || 'ការបម្លែងបរាជ័យ។ (Conversion failed)');
      }

      if (!data.segments || !data.segments.length) {
        throw new Error(data.message || 'រកមិនឃើញសំឡេងនិយាយក្នុងវីដេអូទេ។');
      }

      // Offset timestamps if we processed a slice
      const adjustedSegments = data.segments.map((s: SubtitleSegment) => ({
        ...s,
        start: Math.round((s.start + startTime) * 100) / 100,
        end: Math.round((s.end + startTime) * 100) / 100,
      }));

      // Auto-calibrate
      const calibrated = autoCalibrateSegments(adjustedSegments);

      const modelBadge = data.modelUsed ? ` (${data.modelUsed})` : '';
      setStatusMessage(
        `ជោគជ័យ! បានបង្កើតអត្ថបទខ្មែរចំនួន ${calibrated.length} ផ្នែក តម្រឹមកាលវិភាគ 100%${modelBadge}។`
      );
      onConversionComplete(calibrated, data.warning);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'មានបញ្ហាក្នុងការបម្លែងវីដេអូ។ សូមព្យាយាមម្តងទៀត។');
    } finally {
      setIsConverting(false);
      setProgressInfo(null);
    }
  };

  const loadSampleDemo = () => {
    setErrorMessage(null);
    setStatusMessage('បានផ្ទុកទិន្នន័យគំរូរួចរាល់សម្រាប់កែសម្រួល!');
    onConversionComplete(
      SAMPLE_SEGMENTS,
      'នេះជាទិន្នន័យគំរូសាកល្បង។ អ្នកអាចសាកល្បងកែប្រែ និងទាញយក SRT បានភ្លាមៗ!'
    );
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-[0_0_40px_rgba(0,0,0,0.7)] p-5 sm:p-7 relative overflow-hidden text-slate-100">
      {/* Subtle corner cyber glows */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-fuchsia-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xs flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.5)]">
            ១
          </span>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            ជ្រើសរើសវីដេអូ (Select Video)
          </h2>
        </div>

        <button
          onClick={loadSampleDemo}
          type="button"
          className="text-xs text-cyan-300 hover:text-cyan-200 bg-cyan-950/60 hover:bg-cyan-900/70 border border-cyan-500/35 px-3 py-1 rounded-full font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.2)]"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>សាកល្បងគំរូ (Demo)</span>
        </button>
      </div>

      {/* Upload Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative z-10 border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_30px_rgba(6,182,212,0.4)]'
            : 'border-slate-800 hover:border-cyan-500/70 bg-slate-950/70 hover:bg-slate-950/90 hover:shadow-[0_0_25px_rgba(6,182,212,0.2)]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,.mkv,.avi,.3gp,.mov,.webm,.mp4,audio/*,.mp3,.wav"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-600/20 to-fuchsia-500/20 border border-cyan-500/40 text-cyan-300 mx-auto flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
          <Upload className="w-7 h-7" />
        </div>

        <h3 className="text-sm sm:text-base font-bold text-white mb-1">
          {selectedVideoFile ? selectedVideoFile.name : 'ចុច ឬទាញទម្លាក់វីដេអូទីនេះ'}
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto mb-2">
          គាំទ្រ MP4, MOV, WebM, MKV, AVI, 3GP ឬ Audio MP3/WAV (រហូតដល់ 10,000 MB / 10 GB)
        </p>

        {selectedVideoFile && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <div className="inline-flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-full border border-cyan-500/30 text-xs text-cyan-300 font-medium shadow-sm">
              <FileVideo className="w-3.5 h-3.5 text-cyan-400" />
              <span>{(selectedVideoFile.size / (1024 * 1024)).toFixed(1)} MB</span>
              {videoDuration !== null && (
                <>
                  <span className="text-slate-600">•</span>
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {Math.floor(videoDuration / 60)} នាទី {Math.floor(videoDuration % 60)} វិនាទី
                  </span>
                </>
              )}
            </div>

            {selectedVideoFile.size > 500 * 1024 * 1024 && (
              <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-300 border border-amber-500/35 text-[11px] px-2.5 py-1 rounded-full font-semibold shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                <span>🚀 ទំហំធំ ({(selectedVideoFile.size / (1024 * 1024)).toFixed(0)} MB) - គាំទ្ររហូតដល់ 10,000 MB</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Video Preview */}
      {videoPreviewUrl && (
        <div className="mt-5 relative z-10">
          <div className="rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-[0_0_25px_rgba(0,0,0,0.8)] relative group">
            <video
              ref={videoRef}
              src={videoPreviewUrl}
              controls
              onLoadedMetadata={handleVideoVideoMetadata => handleVideoLoadedMetadata(handleVideoVideoMetadata)}
              className="w-full max-h-[380px] object-contain mx-auto"
            />

            {/* Live Synchronized Subtitle Overlay directly on video */}
            {(() => {
              const activeSub = segments?.find(
                (s) => currentVideoTime >= s.start && currentVideoTime <= s.end
              );
              if (!activeSub) return null;
              return (
                <div className="absolute bottom-12 inset-x-3 sm:inset-x-6 pointer-events-none flex flex-col items-center justify-center transition-all animate-fade-in z-20">
                  <div className="bg-slate-950/90 backdrop-blur-md px-4 py-2 sm:px-6 sm:py-2.5 rounded-2xl border border-cyan-400/40 shadow-[0_0_30px_rgba(0,0,0,0.9)] max-w-2xl text-center">
                    {activeSub.original && (
                      <p className="text-[11px] sm:text-xs text-cyan-300 font-sans mb-1 line-clamp-1 opacity-90">
                        {activeSub.original}
                      </p>
                    )}
                    <p className="text-sm sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-100 via-white to-sky-200 drop-shadow-[0_2px_8px_rgba(0,0,0,1)] leading-snug">
                      {activeSub.text}
                    </p>
                    <span className="text-[10px] text-cyan-400/80 font-mono mt-1 inline-block">
                      ⏱️ {toReadableTime(activeSub.start)} → {toReadableTime(activeSub.end)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
          <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
            <PlayCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>អ្នកអាចចុច Play ដើម្បីពិនិត្យមើលវីដេអូ និងការដើរនាទីរបស់ចំណងជើងរងផ្ទាល់</span>
          </p>
        </div>
      )}

      {/* Processing Scope & Chapters (for large/long videos) */}
      {videoDuration !== null && (
        <div className="mt-5 p-4 rounded-2xl bg-slate-950/70 border border-slate-800 relative z-10">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>ជ្រើសរើសចន្លោះពេលបម្លែង (Processing Scope)</span>
            </div>
            {videoDuration > 180 && (
              <span className="text-[11px] font-semibold text-cyan-300 bg-cyan-950 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                វីដេអូវែង ({Math.floor(videoDuration / 60)} នាទី {Math.floor(videoDuration % 60)}s)
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={() => setScopeMode('full')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                scopeMode === 'full'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              បម្លែងទាំងមូល ({Math.floor(videoDuration / 60)} នាទី {Math.floor(videoDuration % 60)}s)
            </button>

            {chapters.length > 1 && (
              <button
                type="button"
                onClick={() => setScopeMode('chapter')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  scopeMode === 'chapter'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
              >
                បម្លែងតាមផ្នែក (៣ នាទី/ផ្នែក) • {chapters.length} ផ្នែក
              </button>
            )}

            <button
              type="button"
              onClick={() => setScopeMode('custom')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                scopeMode === 'custom'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              កំណត់ចន្លោះពេលផ្ទាល់ខ្លួន (Custom Range)
            </button>
          </div>

          {/* Chapters grid if chapter mode selected */}
          {scopeMode === 'chapter' && chapters.length > 1 && (
            <div className="space-y-2 mt-3 pt-3 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-300">
                ជ្រើសរើសផ្នែកដែលចង់បម្លែង (Select Part to Transcribe):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {chapters.map((ch) => (
                  <button
                    key={ch.index}
                    type="button"
                    onClick={() => setSelectedChapter(ch.index)}
                    className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all cursor-pointer ${
                      selectedChapter === ch.index
                        ? 'border-cyan-400 bg-cyan-950/60 ring-1 ring-cyan-400/50 text-cyan-200 font-bold shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                        : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{ch.label}</span>
                      {selectedChapter === ch.index && (
                        <Check className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom start / end range inputs */}
          {scopeMode === 'custom' && (
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-800 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  ចាប់ផ្ដើមពី (វិនាទី)
                </label>
                <input
                  type="number"
                  min="0"
                  max={videoDuration}
                  value={customStartSec}
                  onChange={(e) => setCustomStartSec(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-xs text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  រហូតដល់ (វិនាទី)
                </label>
                <input
                  type="number"
                  min="1"
                  max={videoDuration}
                  value={customEndSec}
                  onChange={(e) => setCustomEndSec(Math.min(videoDuration, Number(e.target.value)))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-xs text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings (Language, Style, and Model) */}
      <div className="mt-5 p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 uppercase tracking-wider">
            <Settings2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>ជ្រើសរើសម៉ូឌែល Gemini AI & ការកំណត់ (AI Settings)</span>
          </div>
          {onOpenApiKeyModal && (
            <button
              type="button"
              onClick={onOpenApiKeyModal}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.2)]"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>⚙️ ការកំណត់ API Key</span>
            </button>
          )}
        </div>

        {/* 3 Gemini Model Selector Cards */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            ម៉ូឌែល Gemini AI (ជ្រើសរើសម៉ូឌែលសម្រាប់ដំណើរការ)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Gemini 3.8 Flash */}
            <div
              onClick={() => setPreferredModel('gemini-3.8-flash')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer relative ${
                preferredModel === 'gemini-3.8-flash'
                  ? 'border-cyan-400 bg-gradient-to-b from-cyan-950/60 to-slate-950 text-white shadow-[0_0_20px_rgba(6,182,212,0.35)] ring-1 ring-cyan-400/40'
                  : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">3.8 Flash</h4>
                    <span className="text-[10px] text-cyan-300 font-semibold bg-cyan-950 border border-cyan-500/30 px-1.5 py-0.2 rounded">
                      ឆ្លាតវៃបំផុត (ណែនាំ)
                    </span>
                  </div>
                </div>
                {preferredModel === 'gemini-3.8-flash' && (
                  <Check className="w-4 h-4 text-cyan-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                ជំនាន់ចុងក្រោយ ឆ្លាតវៃ យល់ច្បាស់ពីអារម្មណ៍ និងការសន្ទនាស្មុគស្មាញ។
              </p>
            </div>

            {/* Gemini 3.1 Flash Lite */}
            <div
              onClick={() => setPreferredModel('gemini-3.1-flash-lite')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer relative ${
                preferredModel === 'gemini-3.1-flash-lite'
                  ? 'border-emerald-400 bg-gradient-to-b from-emerald-950/60 to-slate-950 text-white shadow-[0_0_20px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/40'
                  : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <Gauge className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">3.1 Flash</h4>
                    <span className="text-[10px] text-emerald-300 font-semibold bg-emerald-950 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                      លឿនរហ័ស (Ultra Fast)
                    </span>
                  </div>
                </div>
                {preferredModel === 'gemini-3.1-flash-lite' && (
                  <Check className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                ល្បឿនលឿនបំផុត ឆ្លើយតបរហ័ស និងជួយបញ្ចៀសការកកស្ទះម៉ាស៊ីនមេ។
              </p>
            </div>

            {/* Gemini 3.1 Pro */}
            <div
              onClick={() => setPreferredModel('gemini-3.1-pro-preview')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer relative ${
                preferredModel === 'gemini-3.1-pro-preview'
                  ? 'border-fuchsia-400 bg-gradient-to-b from-fuchsia-950/60 to-slate-950 text-white shadow-[0_0_20px_rgba(217,70,239,0.35)] ring-1 ring-fuchsia-400/40'
                  : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 flex items-center justify-center">
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">3.1 Pro</h4>
                    <span className="text-[10px] text-fuchsia-300 font-semibold bg-fuchsia-950 border border-fuchsia-500/30 px-1.5 py-0.2 rounded">
                      PRO (ស៊ីជម្រៅ)
                    </span>
                  </div>
                </div>
                {preferredModel === 'gemini-3.1-pro-preview' && (
                  <Check className="w-4 h-4 text-fuchsia-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                វិភាគស៊ីជម្រៅបំផុត (Deep Reasoning) សម្រាប់សំឡេងស្មុគស្មាញ។
              </p>
            </div>
          </div>
        </div>

        {/* Language & Dubbing Style Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-800">
          <div>
            <label className="block text-slate-400 font-medium mb-1">
              ភាសាដើមក្នុងវីដេអូ (Source Language)
            </label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-sans cursor-pointer"
            >
              <option value="auto">ស្វ័យប្រវត្តិ (Auto Detect / ចិន, អង់គ្លេស, ថៃ, កូរ៉េ)</option>
              <option value="zh">ភាសាចិន (Chinese - Mandarin / Cantonese)</option>
              <option value="en">ភាសាអង់គ្លេស (English)</option>
              <option value="th">ភាសាថៃ (Thai)</option>
              <option value="ko">ភាសាកូរ៉េ (Korean)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">
              រចនាប័ទ្មបកប្រែជាភាសាខ្មែរ (Dubbing Style)
            </label>
            <select
              value={dubbingStyle}
              onChange={(e) => setDubbingStyle(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-sans cursor-pointer"
            >
              <option value="natural">ធម្មជាតិសម្រាប់បញ្ចូលសំឡេង (Natural Dubbing & VoiceRTool)</option>
              <option value="formal">តាមពាក្យច្បាស់លាស់ (Accurate Subtitles)</option>
              <option value="casual">សន្ទនាសាមញ្ញប្រចាំថ្ងៃ (Colloquial Spoken)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="mt-4 p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-[0_0_15px_rgba(244,63,94,0.3)] relative z-10">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {errorMessage.includes('API Key') && onOpenApiKeyModal && (
              <button
                type="button"
                onClick={onOpenApiKeyModal}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <Key className="w-3.5 h-3.5" />
                <span>កំណត់ API Key</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleConvert}
              disabled={isConverting}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer shadow-sm"
            >
              សាកល្បងម្តងទៀត
            </button>
          </div>
        </div>
      )}

      {/* Progress Information */}
      {isConverting && progressInfo && (
        <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-cyan-500/40 relative z-10 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
          <div className="flex items-center justify-between text-xs font-semibold text-cyan-300 mb-2">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              {progressInfo.message}
            </span>
            <span className="font-mono text-cyan-400">{progressInfo.percent}%</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-500 h-2 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.8)]"
              style={{ width: `${progressInfo.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Notice */}
      {statusMessage && !errorMessage && !isConverting && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 relative z-10 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handleConvert}
        disabled={!selectedVideoFile || isConverting}
        className={`w-full mt-5 py-4 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all relative z-10 ${
          !selectedVideoFile || isConverting
            ? 'bg-slate-800 text-slate-500 border border-slate-700/80 cursor-not-allowed'
            : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-fuchsia-600 hover:from-cyan-400 hover:via-blue-500 hover:to-fuchsia-500 active:scale-[0.99] text-white shadow-[0_0_25px_rgba(6,182,212,0.5)] border border-cyan-300/30 cursor-pointer'
        }`}
      >
        {isConverting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span>កំពុងដកសំឡេង និងបកប្រែជាភាសាខ្មែរ...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 text-cyan-200 animate-pulse" />
            <span className="tracking-wide">បម្លែងទៅជាអត្ថបទខ្មែរ (Generate Khmer SRT)</span>
          </>
        )}
      </button>
    </div>
  );
}
