import React, { useRef, useState, useEffect } from 'react';
import { Header } from './components/Header';
import { VideoUploader } from './components/VideoUploader';
import { SubtitleEditor } from './components/SubtitleEditor';
import { ApiKeyModal } from './components/ApiKeyModal';
import { SubtitleSegment } from './utils/subtitleUtils';
import { RotateCcw, Sparkles } from 'lucide-react';
import { AppLogoIcon } from './components/AppLogo';

export default function App() {
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [warningNotice, setWarningNotice] = useState<string>('');
  const [currentVideoTime, setCurrentVideoTime] = useState<number>(0);
  const [preferredModel, setPreferredModel] = useState<string>('gemini-3.8-flash');
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
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans relative selection:bg-cyan-500 selection:text-black">
      {/* Background ambient glowing cosmic light spots */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[140px] pointer-events-none" />
      
      <Header onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-6 relative z-10">
        {/* Intro Hero Banner with exact Cyber Neon Logo Aesthetic */}
        <div className="bg-slate-950/90 text-white rounded-3xl p-5 sm:p-7 shadow-[0_0_40px_rgba(0,0,0,0.8)] relative overflow-hidden border border-slate-800">
          {/* Subtle cosmic stars and cyber diagonal lines background */}
          <div className="absolute inset-0 bg-radial from-blue-900/30 via-slate-950/80 to-slate-950 pointer-events-none" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Angled cyber circuits overlay */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 1px, transparent 1px), linear-gradient(45deg, rgba(217, 70, 239, 0.15) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
            {/* Logo Icon with glowing orbital rings */}
            <div className="shrink-0 p-2">
              <AppLogoIcon size="xl" />
            </div>

            {/* Title & Description */}
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-semibold backdrop-blur-xs mb-3 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
                <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
                <span>AI Subtitle & Dubbing Engine</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-200 drop-shadow-[0_0_12px_rgba(56,189,248,0.5)] mb-1 font-sans">
                Khmer Video to SRT
              </h2>

              <p className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-200 via-fuchsia-200 to-pink-200 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] mb-2.5 font-sans">
                បម្លែងវីដេអូទៅជាចំណងជើង SRT
              </p>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                ដកស្រង់សំឡេង ស្គាល់ការសន្ទនាពីភាសាចិន អង់គ្លេស ថៃ ឬកូរ៉េ និងបកប្រែជាភាសាខ្មែរធម្មជាតិ
                ស័ក្តិសមឥតខ្ចោះសម្រាប់ការបញ្ចូលសំឡេងរឿង និងការប្រើប្រាស់ជាមួយ VoiceRTool។
              </p>
            </div>
          </div>
        </div>

        {/* Step 1: Video Uploader & Converter */}
        <VideoUploader
          onVideoSelected={handleVideoSelected}
          onConversionComplete={handleConversionComplete}
          selectedVideoFile={selectedVideoFile}
          videoPreviewUrl={videoPreviewUrl}
          videoRef={videoRef}
          currentVideoTime={currentVideoTime}
          segments={segments}
          onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        />

        {/* Real-time Subtitle Overlay Preview if video is loaded and segments exist */}
        {videoPreviewUrl && segments.length > 0 && activeSegment && (
          <div className="p-3 bg-slate-950/90 text-white text-center rounded-2xl text-sm font-semibold shadow-[0_0_20px_rgba(6,182,212,0.2)] border border-cyan-500/30 animate-fade-in backdrop-blur-md">
            <span className="text-cyan-400 mr-2 text-xs font-mono">
              [{activeSegment.start.toFixed(1)}s - {activeSegment.end.toFixed(1)}s]
            </span>
            <span className="text-slate-100">{activeSegment.text}</span>
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
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-cyan-300 hover:bg-slate-900/80 border border-slate-800 hover:border-cyan-500/30 rounded-full inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ចាប់ផ្តើមឡើងវិញ (Reset Video & Subtitles)</span>
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-950/90 py-6 mt-12 text-center text-xs text-slate-400 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 space-y-1">
          <p className="font-semibold text-slate-300">
            Khmer Video to SRT Studio · ដំណើរការដោយ Google Gemini AI
          </p>
          <p className="text-slate-500">
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
