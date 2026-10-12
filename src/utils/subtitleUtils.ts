export interface SubtitleSegment {
  id: number;
  start: number;
  end: number;
  original: string;
  text: string;
}

/**
 * Format seconds to standard SubRip (SRT) timestamp: HH:MM:SS,mmm
 * Strictly complies with SubRip specification (comma for milliseconds)
 */
export function toSrtTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;

  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    String(secs).padStart(2, '0') +
    ',' +
    String(millis).padStart(3, '0')
  );
}

/**
 * Format seconds to WebVTT timestamp: HH:MM:SS.mmm
 */
export function toVttTimestamp(seconds: number): string {
  return toSrtTimestamp(seconds).replace(',', '.');
}

/**
 * Format seconds to compact readable time: MM:SS.s
 */
export function toReadableTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}:${Number(secs) < 10 ? '0' : ''}${secs}`;
}

/**
 * Clean and normalize Khmer dialogue text specifically for VoiceRTool TTS:
 * - Removes bracketed noises like [សើច], [តន្ត្រី], (sound), [មិនច្បាស់]
 * - Strips unwanted formatting characters
 * - Normalizes Khmer spacing and punctuation
 */
export function cleanTextForVoiceRTool(text: string): string {
  if (!text) return '';
  return text
    // Remove sound/music annotations in brackets
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\{[^}]*\}/g, '')
    // Remove markdown asterisks, hashes, backticks
    .replace(/[*_~`#]/g, '')
    // Replace zero-width spaces that sometimes confuse TTS engines
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    // Collapse multiple spaces into single space
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Generate 100% VoiceRTool compliant SubRip (.srt) format:
 * 1. Uses CRLF (\r\n) line breaks required by Windows & VoiceRTool
 * 2. Guaranteed sequential index numbering (1, 2, 3...)
 * 3. Strict HH:MM:SS,mmm --> HH:MM:SS,mmm timestamp notation
 * 4. Strips empty subtitles that break parser state machines
 * 5. Cleans sound effects so Khmer AI voice reads fluently
 */
export function generateVoiceRToolSrt(segments: SubtitleSegment[]): string {
  const valid = segments
    .filter((s) => s.text && cleanTextForVoiceRTool(s.text).length > 0)
    .sort((a, b) => a.start - b.start);

  return (
    valid
      .map((s, index) => {
        const cleanText = cleanTextForVoiceRTool(s.text);
        const startTime = toSrtTimestamp(Math.max(0, s.start));
        const endTime = toSrtTimestamp(Math.max(s.start + 0.1, s.end));
        return `${index + 1}\r\n${startTime} --> ${endTime}\r\n${cleanText}`;
      })
      .join('\r\n\r\n') + '\r\n'
  );
}

/**
 * Generate VoiceRTool clean line-by-line script (.txt)
 * Perfect for VoiceRTool batch text-to-speech dubbing mode
 */
export function generateVoiceRToolScript(segments: SubtitleSegment[]): string {
  const valid = segments
    .filter((s) => s.text && cleanTextForVoiceRTool(s.text).length > 0)
    .sort((a, b) => a.start - b.start);

  return valid.map((s) => cleanTextForVoiceRTool(s.text)).join('\r\n\r\n') + '\r\n';
}

/**
 * Standard SRT text generator (with CRLF)
 */
export function generateSrtContent(segments: SubtitleSegment[]): string {
  return generateVoiceRToolSrt(segments);
}

/**
 * Standard WebVTT generator
 */
export function generateVttContent(segments: SubtitleSegment[]): string {
  const ordered = [...segments].sort((a, b) => a.start - b.start);
  return (
    'WEBVTT\r\n\r\n' +
    ordered
      .map((s, index) => {
        const cleanText = cleanTextForVoiceRTool(s.text) || s.text.trim();
        return `${index + 1}\r\n${toVttTimestamp(s.start)} --> ${toVttTimestamp(s.end)}\r\n${cleanText}`;
      })
      .join('\r\n\r\n') +
    '\r\n'
  );
}

/**
 * Generate plain text script
 */
export function generateTxtContent(segments: SubtitleSegment[], includeTimestamps = false): string {
  const ordered = [...segments].sort((a, b) => a.start - b.start);
  if (!includeTimestamps) {
    return ordered
      .map((s) => cleanTextForVoiceRTool(s.text) || s.text.trim())
      .join('\r\n\r\n');
  }
  return ordered
    .map(
      (s) =>
        `[${toReadableTime(s.start)} - ${toReadableTime(s.end)}] ${cleanTextForVoiceRTool(s.text) || s.text.trim()}`
    )
    .join('\r\n');
}

/**
 * Download file in browser with UTF-8 BOM so Khmer script renders correctly in all applications
 */
export function downloadFile(filename: string, text: string, mimeType: string) {
  // Prepend UTF-8 BOM (\uFEFF) to guarantee correct Khmer rendering on Windows/VoiceRTool
  const blob = new Blob(['\uFEFF', text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Sample segments for instant preview/testing
 */
export const SAMPLE_SEGMENTS: SubtitleSegment[] = [
  {
    id: 1,
    start: 0.5,
    end: 3.2,
    original: 'Hello everyone, welcome back to today’s episode!',
    text: 'សួស្តីអ្នកទាំងអស់គ្នា សូមស្វាគមន៍មកកាន់វីដេអូភាគថ្មីថ្ងៃនេះ!',
  },
  {
    id: 2,
    start: 3.5,
    end: 7.0,
    original: 'Today we will discover the most exciting secrets of this ancient story.',
    text: 'ថ្ងៃនេះយើងនឹងមកស្វែងយល់អំពីរឿងរ៉ាវអាថ៌កំបាំងដ៏អស្ចារ្យបំផុតនៃប្រវត្តិសាស្ត្រមួយនេះ។',
  },
  {
    id: 3,
    start: 7.4,
    end: 11.2,
    original: 'Don’t forget to subscribe and turn on the bell notification.',
    text: 'កុំភ្លេចចុច Subscribe និងបើកកណ្តឹងជូនដំណឹង ដើម្បីកុំឱ្យខកខានវីដេអូថ្មីៗ!',
  },
  {
    id: 4,
    start: 11.8,
    end: 15.6,
    original: 'Let’s get right into the main journey right now.',
    text: 'ឥឡូវនេះ ចូរយើងចាប់ផ្តើមដំណើររឿងជាមួយគ្នាតែម្តងទៅ។',
  },
];
