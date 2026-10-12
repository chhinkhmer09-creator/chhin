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
import { SubtitleSegment, SAMPLE_SEGMENTS } from '../utils/subtitleUtils';

interface VideoUploaderProps {
  onVideoSelected: (file: File | null, videoUrl: string | null) => void;
  onConversionComplete: (segments: SubtitleSegment[], warning?: string) => void;
  selectedVideoFile: File | null;
  videoPreviewUrl: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentVideoTime: number;
  onOpenApiKeyModal?: () => void;
}

export function VideoUploader({
  onVideoSelected,
  onConversionComplete,
  selectedVideoFile,
  videoPreviewUrl,
  videoRef,
  currentVideoTime,
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
  const [preferredModel, setPreferredModel] = useState<string>('gemini-2.5-flash');
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

  // Compute 10-minute chapters for long videos
  const chapterLength = 600; // 10 minutes (600s)
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

    // If Full Video is selected and duration is longer than 10 minutes, process chapters sequentially
    if (scopeMode === 'full' && chapters.length > 1) {
      try {
        let allSegments: SubtitleSegment[] = [];
        let lastWarning = '';
        let usedModelName = '';

        for (let i = 0; i < chapters.length; i++) {
          const ch = chapters[i];
          setStatusMessage(`កំពុងដកសំឡេង និងបកប្រែ ${ch.label} (${i + 1}/${chapters.length})...`);

          const { base64, mimeType } = await extractAudioFromMedia(
            selectedVideoFile,
            { startTime: ch.start, endTime: ch.end },
            (progress) => {
              setProgressInfo({
                ...progress,
                message: `[ផ្នែកទី ${i + 1}/${chapters.length}] ${progress.message}`,
              });
            }
          );

          setStatusMessage(`កំពុងបកប្រែ ${ch.label} ដោយ Gemini AI...`);

          const customApiKey = (typeof window !== 'undefined' ? localStorage.getItem('byok_gemini_api_key') : '') || '';
          const response = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customApiKey,
              audioBase64: base64,
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

        allSegments = allSegments
          .sort((a, b) => a.start - b.start)
          .map((s, idx) => ({ ...s, id: idx + 1 }));

        const modelBadge = usedModelName ? ` (${usedModelName})` : '';
        setStatusMessage(
          `ជោគជ័យ! បានបង្កើតអត្ថបទខ្មែរគ្រប់ផ្នែកចំនួន ${allSegments.length} ផ្នែក${modelBadge}។`
        );
        onConversionComplete(allSegments, lastWarning);
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
    let endTime = videoDuration || 600;

    if (scopeMode === 'chapter' && chapters[selectedChapter]) {
      startTime = chapters[selectedChapter].start;
      endTime = chapters[selectedChapter].end;
    } else if (scopeMode === 'custom') {
      startTime = Math.max(0, customStartSec);
      endTime = Math.max(startTime + 1, customEndSec);
    } else if (scopeMode === 'full') {
      startTime = 0;
      endTime = Math.min(videoDuration || 600, 600);
    }

    try {
      // Step 1: Extract 16kHz mono audio directly in browser with requested range
      const { base64, mimeType } = await extractAudioFromMedia(
        selectedVideoFile,
        { startTime, endTime },
        (progress) => {
          setProgressInfo(progress);
          setStatusMessage(progress.message);
        }
      );

      setStatusMessage('កំពុងផ្ញើទៅកាន់ Gemini AI ដើម្បីស្តាប់ ស្គាល់ពាក្យ និងបកប្រែជាភាសាខ្មែរ...');

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

      const modelBadge = data.modelUsed ? ` (${data.modelUsed})` : '';
      setStatusMessage(
        `ជោគជ័យ! បានបង្កើតអត្ថបទខ្មែរចំនួន ${adjustedSegments.length} ផ្នែក${modelBadge}។`
      );
      onConversionComplete(adjustedSegments, data.warning);
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
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
            ១
          </span>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            ជ្រើសរើសវីដេអូ (Select Video)
          </h2>
        </div>

        <button
          onClick={loadSampleDemo}
          type="button"
          className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>សាកល្បងគំរូ (Demo)</span>
        </button>
      </div>

      {/* Upload Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70'
            : 'border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-slate-50'
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

        <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 mx-auto flex items-center justify-center mb-3 shadow-inner">
          <Upload className="w-7 h-7" />
        </div>

        <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-1">
          {selectedVideoFile ? selectedVideoFile.name : 'ចុច ឬទាញទម្លាក់វីដេអូទីនេះ'}
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-2">
          គាំទ្រ MP4, MOV, WebM, MKV, AVI, 3GP ឬ Audio MP3/WAV (រហូតដល់ 10,000 MB / 10 GB)
        </p>

        {selectedVideoFile && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <div className="inline-flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-200 text-xs text-slate-600 font-medium">
              <FileVideo className="w-3.5 h-3.5 text-blue-500" />
              <span>{(selectedVideoFile.size / (1024 * 1024)).toFixed(1)} MB</span>
              {videoDuration !== null && (
                <>
                  <span>•</span>
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {Math.floor(videoDuration / 60)} នាទី {Math.floor(videoDuration % 60)} វិនាទី
                  </span>
                </>
              )}
            </div>

            {selectedVideoFile.size > 500 * 1024 * 1024 && (
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-[11px] px-2.5 py-1 rounded-full font-semibold">
                <span>🚀 ទំហំធំ ({(selectedVideoFile.size / (1024 * 1024)).toFixed(0)} MB) - គាំទ្ររហូតដល់ 10,000 MB</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Video Preview */}
      {videoPreviewUrl && (
        <div className="mt-5">
          <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md relative group">
            <video
              ref={videoRef}
              src={videoPreviewUrl}
              controls
              onLoadedMetadata={handleVideoVideoMetadata => handleVideoLoadedMetadata(handleVideoVideoMetadata)}
              className="w-full max-h-[380px] object-contain mx-auto"
            />
          </div>
          <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
            <PlayCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>អ្នកអាចចុច Play ដើម្បីពិនិត្យមើលវីដេអូ និងសំឡេងដើម</span>
          </p>
        </div>
      )}

      {/* Processing Scope & Chapters (for large/long videos) */}
      {videoDuration !== null && (
        <div className="mt-5 p-4 rounded-xl bg-blue-50/50 border border-blue-200/70">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>ជ្រើសរើសចន្លោះពេលបម្លែង (Processing Scope)</span>
            </div>
            {videoDuration > 600 && (
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                វីដេអូវែង ({Math.floor(videoDuration / 60)} នាទី)
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={() => setScopeMode('full')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                scopeMode === 'full'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              បម្លែងទាំងមូល ({Math.floor(videoDuration / 60)} នាទី)
            </button>

            {chapters.length > 1 && (
              <button
                type="button"
                onClick={() => setScopeMode('chapter')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  scopeMode === 'chapter'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                បម្លែងតាមផ្នែក (១០ នាទី/ផ្នែក) • {chapters.length} ផ្នែក
              </button>
            )}

            <button
              type="button"
              onClick={() => setScopeMode('custom')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                scopeMode === 'custom'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              កំណត់ចន្លោះពេលផ្ទាល់ខ្លួន (Custom Range)
            </button>
          </div>

          {/* Chapters grid if chapter mode selected */}
          {scopeMode === 'chapter' && chapters.length > 1 && (
            <div className="space-y-2 mt-3 pt-3 border-t border-blue-200/50">
              <label className="block text-xs font-semibold text-slate-700">
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
                        ? 'border-blue-600 bg-white ring-2 ring-blue-500/20 text-blue-900 font-bold shadow-xs'
                        : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{ch.label}</span>
                      {selectedChapter === ch.index && (
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom start / end range inputs */}
          {scopeMode === 'custom' && (
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-blue-200/50 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  ចាប់ផ្ដើមពី (វិនាទី)
                </label>
                <input
                  type="number"
                  min="0"
                  max={videoDuration}
                  value={customStartSec}
                  onChange={(e) => setCustomStartSec(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  រហូតដល់ (វិនាទី)
                </label>
                <input
                  type="number"
                  min="1"
                  max={videoDuration}
                  value={customEndSec}
                  onChange={(e) => setCustomEndSec(Math.min(videoDuration, Number(e.target.value)))}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings (Language, Style, and Model) */}
      <div className="mt-5 p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Settings2 className="w-3.5 h-3.5 text-blue-600" />
            <span>ជ្រើសរើសម៉ូឌែល Gemini AI & ការកំណត់ (AI Settings)</span>
          </div>
          {onOpenApiKeyModal && (
            <button
              type="button"
              onClick={onOpenApiKeyModal}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-amber-600" />
              <span>⚙️ ការកំណត់ API Key</span>
            </button>
          )}
        </div>

        {/* 3 Gemini Model Selector Cards */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            ម៉ូឌែល Gemini AI (ជ្រើសរើសម៉ូឌែលសម្រាប់ដំណើរការ)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Gemini 2.5 Flash */}
            <div
              onClick={() => setPreferredModel('gemini-2.5-flash')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer relative ${
                preferredModel === 'gemini-2.5-flash'
                  ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Gemini 2.5 Flash</h4>
                    <span className="text-[10px] text-blue-700 font-semibold bg-blue-100 px-1.5 py-0.2 rounded">
                      ណែនាំ (Recommended)
                    </span>
                  </div>
                </div>
                {preferredModel === 'gemini-2.5-flash' && (
                  <Check className="w-4 h-4 text-blue-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed mt-1">
                មានតុល្យភាពល្អ ល្បឿនលឿន និងបកប្រែជាភាសាខ្មែររលូនតាមធម្មជាតិ។
              </p>
            </div>

            {/* Gemini 3.8 Flash */}
            <div
              onClick={() => setPreferredModel('gemini-3.8-flash')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer relative ${
                preferredModel === 'gemini-3.8-flash'
                  ? 'border-indigo-600 bg-indigo-50/60 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Gemini 3.8 Flash</h4>
                    <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-100 px-1.5 py-0.2 rounded">
                      ឆ្លាតវៃបំផុត (Flagship)
                    </span>
                  </div>
                </div>
                {preferredModel === 'gemini-3.8-flash' && (
                  <Check className="w-4 h-4 text-indigo-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed mt-1">
                ជំនាន់ចុងក្រោយ យល់ការសន្ទនាស្មុគស្មាញ និងកំណត់ពេលវេលាច្បាស់លាស់។
              </p>
            </div>

            {/* Gemini 3.1 Flash Lite */}
            <div
              onClick={() => setPreferredModel('gemini-3.1-flash-lite')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer relative ${
                preferredModel === 'gemini-3.1-flash-lite'
                  ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Gauge className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Gemini 3.1 Flash Lite</h4>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-1.5 py-0.2 rounded">
                      លឿនបំផុត (Ultra Fast)
                    </span>
                  </div>
                </div>
                {preferredModel === 'gemini-3.1-flash-lite' && (
                  <Check className="w-4 h-4 text-emerald-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed mt-1">
                ដំណើរការលឿនរហ័សទាន់ចិត្ត និងជួយបញ្ចៀសការកកស្ទះម៉ាស៊ីនមេ (503)។
              </p>
            </div>
          </div>
        </div>

        {/* Language & Dubbing Style Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-200/60">
          <div>
            <label className="block text-slate-600 font-medium mb-1">
              ភាសាដើមក្នុងវីដេអូ (Source Language)
            </label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value as any)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
            >
              <option value="auto">ស្វ័យប្រវត្តិ (Auto Detect / ចិន, អង់គ្លេស, ថៃ)</option>
              <option value="zh">ភាសាចិន (Chinese - Mandarin / Cantonese)</option>
              <option value="en">ភាសាអង់គ្លេស (English)</option>
              <option value="th">ភាសាថៃ (Thai)</option>
              <option value="ko">ភាសាកូរ៉េ (Korean)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">
              រចនាប័ទ្មបកប្រែជាភាសាខ្មែរ (Dubbing Style)
            </label>
            <select
              value={dubbingStyle}
              onChange={(e) => setDubbingStyle(e.target.value as any)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
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
        <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={handleConvert}
            disabled={isConverting}
            className="self-end sm:self-center shrink-0 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
          >
            សាកល្បងម្តងទៀត (Retry)
          </button>
        </div>
      )}

      {/* Progress Information */}
      {isConverting && progressInfo && (
        <div className="mt-4 p-4 rounded-xl bg-blue-50/80 border border-blue-200/80">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-900 mb-2">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              {progressInfo.message}
            </span>
            <span>{progressInfo.percent}%</span>
          </div>
          <div className="w-full bg-blue-200/60 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressInfo.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Notice */}
      {statusMessage && !errorMessage && !isConverting && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handleConvert}
        disabled={!selectedVideoFile || isConverting}
        className={`w-full mt-5 py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
          !selectedVideoFile || isConverting
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white shadow-blue-500/25 cursor-pointer'
        }`}
      >
        {isConverting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>កំពុងដកសំឡេង និងបកប្រែជាភាសាខ្មែរ...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            <span>បម្លែងទៅជាអត្ថបទខ្មែរ (Generate Khmer SRT)</span>
          </>
        )}
      </button>
    </div>
  );
}
