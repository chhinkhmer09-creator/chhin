import React, { useRef, useState, useEffect } from 'react';
import { Header } from './components/Header';
import { VideoUploader } from './components/VideoUploader';
import { SubtitleEditor } from './components/SubtitleEditor';
import { ApiKeyModal } from './components/ApiKeyModal';
import { SubtitleSegment } from './utils/subtitleUtils';
import { RotateCcw, Sparkles } from 'lucide-react';

export default function App() {
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [warningNotice, setWarningNotice] = useState<string>('');
  const [currentVideoTime, setCurrentVideoTime] = useState<number>(0);
  const [preferredModel, setPreferredModel] = useState<string>('gemini-2.5-flash');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sync current video time for active segment tracking and subtitle overlay
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentVideoTime(video.currentTime);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoPreviewUrl]);

  const handleVideoSelected = (file: File | null, url: string | null) => {
    setSelectedVideoFile(file);
    setVideoPreviewUrl(url);
    // If selecting a new video, keep or reset segments
  };

  const handleConversionComplete = (newSegments: SubtitleSegment[], warning?: string) => {
    setSegments(newSegments);
    if (warning) setWarningNotice(warning);

    // Smooth scroll to editor
    setTimeout(() => {
      const editorElement = document.getElementById('subtitle-editor-section');
      if (editorElement) {
        editorElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleReset = () => {
    if (confirm('តើអ្នកចង់ចាប់ផ្តើមឡើងវិញ និងជ្រើសរើសវីដេអូថ្មីមែនទេ?')) {
      setSelectedVideoFile(null);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
      setSegments([]);
      setWarningNotice('');
      setCurrentVideoTime(0);
    }
  };

  // Find active segment for overlay on video
  const activeSegment = segments.find(
    (s) => currentVideoTime >= s.start && currentVideoTime <= s.end
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Header onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {/* Intro Banner */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white rounded-2xl p-5 sm:p-7 shadow-md relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold backdrop-blur-xs mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              បច្ចេកវិទ្យា AI ជំនាន់ចុងក្រោយ
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">
              បម្លែងវីដេអូទៅជាចំណងជើងរង SRT ភាសាខ្មែរ
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
              ដកស្រង់សំឡេង ស្គាល់ការសន្ទនាពីភាសាចិន អង់គ្លេស ថៃ ឬកូរ៉េ និងបកប្រែជាភាសាខ្មែរធម្មជាតិ
              ស័ក្តិសមឥតខ្ចោះសម្រាប់ការបញ្ចូលសំឡេងរឿង និងការប្រើប្រាស់ជាមួយ VoiceRTool។
            </p>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Step 1: Video Uploader & Converter */}
        <VideoUploader
          onVideoSelected={handleVideoSelected}
          onConversionComplete={handleConversionComplete}
          selectedVideoFile={selectedVideoFile}
          videoPreviewUrl={videoPreviewUrl}
          videoRef={videoRef}
          currentVideoTime={currentVideoTime}
          onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        />

        {/* Real-time Subtitle Overlay Preview if video is loaded and segments exist */}
        {videoPreviewUrl && segments.length > 0 && activeSegment && (
          <div className="p-3 bg-slate-900 text-white text-center rounded-xl text-sm font-semibold shadow-inner border border-slate-800 animate-fade-in">
            <span className="text-blue-400 mr-2 text-xs font-mono">
              [{activeSegment.start.toFixed(1)}s - {activeSegment.end.toFixed(1)}s]
            </span>
            <span>{activeSegment.text}</span>
          </div>
        )}

        {/* Step 2: Interactive Subtitle Editor */}
        {segments.length > 0 && (
          <div id="subtitle-editor-section" className="scroll-mt-20">
            <SubtitleEditor
              segments={segments}
              onUpdateSegments={setSegments}
              videoRef={videoRef}
              currentVideoTime={currentVideoTime}
              fileName={selectedVideoFile?.name}
              warningNotice={warningNotice}
              preferredModel={preferredModel}
            />
          </div>
        )}

        {/* Reset / Start Over Bar */}
        {(selectedVideoFile || segments.length > 0) && (
          <div className="flex justify-center pt-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded-full inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ចាប់ផ្តើមឡើងវិញ (Reset Video & Subtitles)</span>
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 space-y-1">
          <p className="font-semibold text-slate-700">
            Khmer Video to SRT Studio · ដំណើរការដោយ Google Gemini AI
          </p>
          <p className="text-slate-400">
            រចនាឡើងយ៉ាងពិសេសសម្រាប់ទូរស័ព្ទ Android កុំព្យូទ័រ និងអ្នកបង្កើតមាតិកាបញ្ចូលសំឡេង
          </p>
        </div>
      </footer>

      {/* 100% Matching BYOK API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />
    </div>
  );
}
