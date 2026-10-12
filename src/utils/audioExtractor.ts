/**
 * Audio extraction and WAV encoding utility
 * Converts browser-decoded audio into 16kHz Mono 16-bit PCM WAV
 * Supports time slicing (start/end) and large media files up to 10,000 MB
 */

export interface ExtractionProgress {
  stage: 'reading' | 'decoding' | 'resampling' | 'encoding' | 'ready';
  message: string;
  percent: number;
}

export interface ExtractionOptions {
  startTime?: number; // in seconds
  endTime?: number;   // in seconds
}

export async function extractAudioFromMedia(
  file: File,
  options?: ExtractionOptions,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<{ base64: string; mimeType: string; duration: number; sliceDuration: number }> {
  onProgress?.({
    stage: 'reading',
    message: `កំពុងអានឯកសារ (${(file.size / (1024 * 1024)).toFixed(0)} MB)...`,
    percent: 15,
  });

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (err: any) {
    throw new Error(
      `មិនអាចផ្ទុកឯកសារទំហំធំចូលទៅក្នុង Memory កុំព្យូទ័របានទេ។ (${err?.message || 'Memory limit'}) សូមសាកល្បងបម្លែងឯកសារជាទម្រង់ MP3/WAV ឬកាត់ជាផ្នែកតូចៗ។`
    );
  }

  onProgress?.({
    stage: 'decoding',
    message: 'កំពុងដកសំឡេងចេញពីវីដេអូ (Decoding Audio Track)...',
    percent: 40,
  });

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtx();

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (decodeErr) {
    console.warn('Native decodeAudioData failed, attempting direct base64 transfer:', decodeErr);
    // If decode fails, fallback to direct transfer if file size allows
    if (file.size > 30 * 1024 * 1024) {
      throw new Error(
        'ទម្រង់ Codec សំឡេងនៃវីដេអូនេះមិនត្រូវបានគាំទ្រដោយផ្ទាល់ដោយ Browser ទេ។ សូមសាកល្បងបម្លែងជា MP4 ស្តង់ដារ ឬដកសំឡេងជា MP3/WAV ជាមុនសិន។'
      );
    }
    const base64 = await fileToBase64(file);
    return {
      base64,
      mimeType: file.type || 'video/mp4',
      duration: 0,
      sliceDuration: 0,
    };
  } finally {
    audioCtx.close().catch(() => {});
  }

  const fullDuration = audioBuffer.duration;
  const startSec = Math.max(0, options?.startTime ?? 0);
  const endSec = Math.min(fullDuration, options?.endTime ?? fullDuration);
  const sliceDuration = Math.max(0.5, endSec - startSec);
  const targetSampleRate = 16000;

  onProgress?.({
    stage: 'resampling',
    message: `កំពុងរៀបចំសំឡេង 16kHz [${Math.floor(startSec / 60)}:${String(Math.floor(startSec % 60)).padStart(2, '0')} - ${Math.floor(endSec / 60)}:${String(Math.floor(endSec % 60)).padStart(2, '0')}]...`,
    percent: 65,
  });

  // Downsample requested slice to 16kHz mono using OfflineAudioContext
  const targetLength = Math.ceil(sliceDuration * targetSampleRate);
  const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0, startSec, sliceDuration);

  const renderedBuffer = await offlineCtx.startRendering();
  const channelData = renderedBuffer.getChannelData(0);

  onProgress?.({
    stage: 'encoding',
    message: 'កំពុងបម្លែងជាទម្រង់ 16kHz WAV ស្រាល...',
    percent: 85,
  });

  const wavBlob = encodeWAV(channelData, targetSampleRate);
  const base64 = await blobToBase64(wavBlob);

  onProgress?.({
    stage: 'ready',
    message: 'រួចរាល់សម្រាប់ការបកប្រែដោយ Gemini AI!',
    percent: 100,
  });

  return {
    base64,
    mimeType: 'audio/wav',
    duration: fullDuration,
    sliceDuration,
  };
}

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, 1, true);
  /* channel count (mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // Write PCM 16-bit samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
