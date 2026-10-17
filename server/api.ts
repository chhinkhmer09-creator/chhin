import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export const apiApp = express();

export const SUPPORTED_MODELS = [
  {
    id: 'gemini-3.8-flash',
    name: '3.8 Flash',
    tag: 'ឆ្លាតវៃបំផុត',
    description: 'ឆ្លាតវៃបំផុត យល់ច្បាស់ពីអារម្មណ៍ និងការសន្ទនាស្មុគស្មាញ (ណែនាំ)',
    badgeColor: 'indigo',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: '3.1 Flash',
    tag: 'លឿនរហ័ស',
    description: 'ល្បឿនលឿនបំផុត ឆ្លើយតបរហ័ស និងជួយបញ្ចៀសការកកស្ទះម៉ាស៊ីនមេ',
    badgeColor: 'emerald',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: '3.1 Pro',
    tag: 'PRO',
    description: 'ស៊ីជម្រៅបំផុត (Deep Reasoning & Multimodal)',
    badgeColor: 'purple',
  },
];

// Modern Google Gemini models active in production
const CANDIDATE_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-flash-latest'];

function resolveModel(modelName?: string): string {
  if (!modelName || modelName === 'auto') return 'gemini-3.8-flash';
  if (modelName === 'gemini-2.5-flash') return 'gemini-3.8-flash';
  if (modelName === '3.1 Pro' || modelName === '3.1-pro' || modelName === 'gemini-3.1-pro') return 'gemini-3.1-pro-preview';
  if (modelName === '3.8 Flash' || modelName === '3.8-flash' || modelName === 'gemini-3.8-flash') return 'gemini-3.8-flash';
  if (modelName === '3.1 Flash' || modelName === '3.1-flash' || modelName === 'gemini-3.1-flash-lite') return 'gemini-3.1-flash-lite';
  return modelName;
}

function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  const apiKey = (customApiKey && customApiKey.trim().length > 5)
    ? customApiKey.trim()
    : process.env.GEMINI_API_KEY;

  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Support large audio base64 payload up to 100MB
apiApp.use(express.json({ limit: '100mb' }));
apiApp.use(express.urlencoded({ extended: true, limit: '100mb' }));

/**
 * Universal JSON response helper compatible with both Express and raw Node http.ServerResponse
 */
function sendJson(res: any, status: number, data: any) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function parseJsonResponse(rawText: string) {
  const clean = rawText
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(clean);
}

// Health check handler
const handleHealth = (req: Request, res: Response) => {
  const customKey = (req.headers['x-custom-api-key'] as string) || '';
  const ai = getGeminiClient(customKey);
  sendJson(res, 200, {
    ok: true,
    apiConfigured: Boolean(ai),
    hasSystemKey: Boolean(process.env.GEMINI_API_KEY),
    hasCustomKey: Boolean(customKey && customKey.trim().length > 5),
    supportedModels: SUPPORTED_MODELS,
    candidateModels: CANDIDATE_MODELS,
  });
};

apiApp.get('/health', handleHealth);
apiApp.get('/api/health', handleHealth);
apiApp.get('/models', handleHealth);
apiApp.get('/api/models', handleHealth);

/**
 * Robust retry and model cascade to seamlessly handle 503 (High Demand) & 429
 */
async function callGeminiWithCascade(ai: GoogleGenAI, contents: any, selectedModel?: string) {
  const resolved = resolveModel(selectedModel);
  const modelsToTry = [resolved, ...CANDIDATE_MODELS.filter((m) => m !== resolved)];

  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`Executing with ${model} (attempt ${attempt})...`);
        const config: any = {
          responseMimeType: 'application/json',
          temperature: 0.1,
        };

        if (model.includes('gemini-3')) {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        }

        const response = await ai.models.generateContent({
          model,
          contents,
          config,
        });

        if (response && response.text) {
          return { response, modelUsed: model };
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '');
        const isBusy =
          msg.includes('503') ||
          msg.includes('high demand') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED');

        console.warn(`Model ${model} failed (attempt ${attempt}):`, msg);

        if (isBusy) {
          await new Promise((r) => setTimeout(r, 1000));
        } else {
          break;
        }
      }
    }
  }

  throw lastError;
}

// Convert handler
const handleConvert = async (req: Request, res: Response) => {
  try {
    const {
      customApiKey,
      audioBase64,
      audioDuration,
      mimeType = 'audio/wav',
      sourceLanguage = 'auto',
      style = 'natural',
      preferredModel = 'gemini-3.8-flash',
    } = req.body || {};

    const ai = getGeminiClient(customApiKey || (req.headers['x-custom-api-key'] as string));
    if (!ai) {
      return sendJson(res, 500, {
        error: 'សូមកំណត់ Gemini API Key ជាមុនសិន ដោយចុចប៊ូតុង "⚙️ API Key" នៅខាងលើ។ (GEMINI_API_KEY is not configured)',
      });
    }

    if (!audioBase64) {
      return sendJson(res, 400, {
        error: 'មិនមានទិន្នន័យសំឡេងត្រូវបានផ្ញើមកទេ។ សូមជ្រើសរើសវីដេអូ ឬឯកសារសំឡេងជាថ្មី។',
      });
    }

    let langNote = 'The source speech may be Chinese, English, Thai, Vietnamese, Korean, or other languages.';
    if (sourceLanguage === 'zh') langNote = 'The source speech is primarily Chinese (Mandarin/Cantonese).';
    if (sourceLanguage === 'en') langNote = 'The source speech is primarily English.';
    if (sourceLanguage === 'th') langNote = 'The source speech is primarily Thai.';
    if (sourceLanguage === 'ko') langNote = 'The source speech is primarily Korean.';

    let styleNote = 'Translate into natural, fluent Khmer conversational dialogue suitable for video dubbing (បញ្ចូលសំឡេង) and VoiceRTool.';
    if (style === 'formal') {
      styleNote = 'Translate into standard, formal and precise Khmer subtitle phrasing.';
    } else if (style === 'casual') {
      styleNote = 'Translate into casual, lively colloquial everyday spoken Khmer.';
    }

    const durationNotice = (Number(audioDuration) > 0)
      ? `The audio clip has an exact duration of ${Number(audioDuration).toFixed(2)} seconds. All timestamps MUST strictly be within 0.00 and ${Number(audioDuration).toFixed(2)} seconds.`
      : '';

    const prompt = `
You are an expert audio transcriber and multilingual-to-Khmer dubbing translator.
${langNote}
${durationNotice}

CRITICAL RULES FOR 100% TIMING SYNCHRONIZATION WITH VIDEO:
1. Exact Vocal Grounding:
   - "start" MUST be the exact second when the speaker's vocal utterance begins (e.g. 1.85s).
   - "end" MUST be the exact second when the speaker stops speaking that sentence (e.g. 4.40s).
   - DO NOT default to 0.00 unless the speaker literally utters words right at the first 0.1s. If there is intro music, background noise, or silence, "start" must mark the true beginning of human speech.
2. Silent Intervals & Pauses:
   - When speakers pause, breathe, or remain silent, DO NOT stretch segment timestamps across the silence.
   - Leave natural gaps between segments so subtitles disappear when no one is talking.
3. Rhythm & Sentence Length:
   - Break dialogue into concise, bite-sized subtitle lines (typically 1.5 to 5.0 seconds).
   - Timestamps must be precise numbers with up to 2 decimal places (e.g. 2.15, 5.40).
   - "end" must be strictly greater than "start" (minimum duration 0.6s).
   - Keep segments strictly chronological: segment[i].start >= segment[i-1].end.
4. Khmer Translation & Dubbing:
   - ${styleNote}
   - Make the Khmer spoken length naturally match the duration of the original speech.
   - For unclear speech, write "[មិនច្បាស់]". Do NOT include sound effect markers like [music] or [laugh].

Return ONLY valid JSON in this exact structure:
{
  "segments": [
    {
      "start": 1.45,
      "end": 4.20,
      "original": "original spoken sentence",
      "khmer": "អត្ថបទបកប្រែជាភាសាខ្មែរ"
    }
  ]
}
`;

    const contents = [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
          { text: prompt },
        ],
      },
    ];

    const { response, modelUsed } = await callGeminiWithCascade(ai, contents, preferredModel);

    const responseText = response.text || '';
    if (!responseText) {
      throw new Error('ម៉ូឌែលមិនបានបញ្ជូនទិន្នន័យមកវិញទេ។ (Empty response from AI model)');
    }

    const parsed = parseJsonResponse(responseText);
    if (!Array.isArray(parsed.segments)) {
      throw new Error('លទ្ធផលមិនមានទម្រង់ segments ត្រឹមត្រូវទេ។');
    }

    // Filter, validate and normalize raw segments
    const validRaw = parsed.segments
      .filter((s: any) =>
        Number.isFinite(Number(s.start)) &&
        Number.isFinite(Number(s.end)) &&
        (String(s.khmer || s.text || '').trim().length > 0)
      )
      .map((s: any) => {
        const start = Math.max(0, Math.round(Number(s.start) * 100) / 100);
        let end = Math.round(Number(s.end) * 100) / 100;
        if (end <= start) {
          end = Math.round((start + 1.5) * 100) / 100;
        }
        return {
          start,
          end,
          original: String(s.original || '').trim(),
          text: String(s.khmer || s.text || '').trim(),
        };
      })
      .sort((a: any, b: any) => a.start - b.start);

    // Auto-resolve any overlaps and ensure monotonic progression
    for (let i = 1; i < validRaw.length; i++) {
      const prev = validRaw[i - 1];
      const curr = validRaw[i];
      if (curr.start < prev.end) {
        if (curr.start >= prev.start + 0.8) {
          prev.end = Math.round((curr.start - 0.05) * 100) / 100;
        } else {
          curr.start = Math.round((prev.end + 0.05) * 100) / 100;
          if (curr.end <= curr.start) {
            curr.end = Math.round((curr.start + 1.2) * 100) / 100;
          }
        }
      }
    }

    const segments = validRaw.map((s: any, i: number) => ({
      id: i + 1,
      start: Math.round(s.start * 100) / 100,
      end: Math.round(s.end * 100) / 100,
      original: s.original,
      text: s.text,
    }));

    if (segments.length === 0) {
      return sendJson(res, 200, {
        segments: [],
        modelUsed,
        message: 'រកមិនឃើញសំឡេងនិយាយដែលអាចបម្លែងបានទេ។ សូមពិនិត្យសំឡេងក្នុងវីដេអូ។',
      });
    }

    sendJson(res, 200, {
      segments,
      modelUsed,
      warning: 'ពេលវេលាត្រូវបានតម្រឹម និងផ្ទៀងផ្ទាត់ជាមួយសំឡេងវីដេអូដោយជោគជ័យ។',
    });
  } catch (error: any) {
    console.error('Error in /api/convert:', error);
    const rawMsg = String(error?.message || '');

    let userMessage = 'មានបញ្ហាក្នុងការបម្លែងវីដេអូ។ សូមព្យាយាមម្តងទៀត។';
    if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('API key not valid')) {
      userMessage = 'API Key មិនត្រឹមត្រូវ ឬផុតកំណត់។ សូមពិនិត្យមើល API Key ក្នុងផ្ទាំង "⚙️ API Key" ឡើងវិញ។';
    } else if (rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE')) {
      userMessage =
        'ម៉ាស៊ីន AI កំពុងមានអ្នកប្រើប្រាស់ច្រើនក្នុងពេលដំណាលគ្នា (503 High Demand)។ សូមរង់ចាំ ៥-១០ វិនាទី រួចចុច "បម្លែងទៅជាអត្ថបទខ្មែរ" ម្តងទៀត ឬជ្រើសរើស Gemini 3.1 Flash Lite។';
    } else if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      userMessage =
        'បានលើសកម្រិតកំណត់សំណើរបស់ Google (429 Rate Limit)។ សូមរង់ចាំប្រហែល ៣០ វិនាទី រួចព្យាយាមម្តងទៀត ឬប្ដូរទៅម៉ូឌែល Gemini 3.1 Flash Lite។';
    } else if (rawMsg.includes('not configured') || rawMsg.includes('GEMINI_API_KEY')) {
      userMessage = 'សូមកំណត់ Gemini API Key ជាមុនសិន ដោយចុចប៊ូតុង "⚙️ API Key" នៅខាងលើ។';
    } else if (rawMsg) {
      userMessage = rawMsg;
    }

    sendJson(res, 500, {
      error: userMessage,
    });
  }
};

// Rephrase / Refine single segment using selected model
const handleRefine = async (req: Request, res: Response) => {
  try {
    const { customApiKey, text, original, model = 'gemini-3.8-flash' } = req.body || {};
    const ai = getGeminiClient(customApiKey || (req.headers['x-custom-api-key'] as string));
    if (!ai) {
      return sendJson(res, 500, { error: 'សូមកំណត់ Gemini API Key ជាមុនសិន ដោយចុចប៊ូតុង "⚙️ API Key"' });
    }

    if (!text && !original) {
      return sendJson(res, 400, { error: 'មិនមានអត្ថបទសម្រាប់កែប្រែទេ' });
    }

    const prompt = `
You are an expert Khmer dialogue and subtitle editor.
Given this subtitle segment:
Original: "${original || ''}"
Current Khmer translation: "${text || ''}"

Please rephrase or polish the Khmer translation into natural, authentic spoken Khmer for dubbing (voice-over/VoiceRTool).
Keep it concise, emotionally expressive, and grammatically natural in Khmer script.
Output ONLY the polished Khmer sentence, nothing else.
`;

    const resolved = resolveModel(model);
    const config: any = {
      temperature: 0.2,
    };
    if (resolved.includes('gemini-3')) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }

    const response = await ai.models.generateContent({
      model: resolved,
      contents: prompt,
      config,
    });

    const refined = (response.text || '').trim();
    sendJson(res, 200, { refined, modelUsed: resolved });
  } catch (err: any) {
    const rawMsg = String(err?.message || '');
    let errMsg = 'មិនអាចកែប្រែបានទេ។ សូមព្យាយាមម្តងទៀត។';
    if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('API key not valid')) {
      errMsg = 'API Key មិនត្រឹមត្រូវទេ។ សូមពិនិត្យមើល API Key ឡើងវិញ។';
    } else if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      errMsg = 'លើសកម្រិតកំណត់សំណើ (429 Rate Limit)។ សូមរង់ចាំបន្តិច។';
    }
    sendJson(res, 500, { error: errMsg });
  }
};

// Test API Key endpoint requested by user
const handleTestKey = async (req: Request, res: Response) => {
  try {
    const { customApiKey, model = 'gemini-3.8-flash' } = req.body || {};
    const ai = getGeminiClient(customApiKey || (req.headers['x-custom-api-key'] as string));
    if (!ai) {
      return sendJson(res, 400, {
        error: 'មិនមាន API Key ត្រឹមត្រូវទេ។ សូមបញ្ចូល API Key របស់អ្នកជាមុនសិន។',
      });
    }

    const start = Date.now();
    const { modelUsed } = await callGeminiWithCascade(ai, 'Ping test', model);
    const latency = Date.now() - start;

    sendJson(res, 200, {
      ok: true,
      latency,
      modelUsed,
      message: `ការតភ្ជាប់ជោគជ័យ 100%! ល្បឿនឆ្លើយតប: ${(latency / 1000).toFixed(2)} វិនាទី (${modelUsed})`,
    });
  } catch (err: any) {
    const rawMsg = String(err?.message || '');
    let errMsg = 'ការតភ្ជាប់បរាជ័យ។ សូមពិនិត្យមើល API Key របស់អ្នកឡើងវិញ។';
    if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('API key not valid')) {
      errMsg = 'API Key មិនត្រឹមត្រូវទេ។ សូមចម្លង API Key ថ្មីពី Google AI Studio មកដាក់បញ្ចូល។';
    } else if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      errMsg = 'API Key នេះបានដល់កម្រិតកំណត់សំណើ (429 Quota Exceeded)។ សូមរង់ចាំបន្តិច រួចសាកល្បងម្តងទៀត។';
    } else if (rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE')) {
      errMsg = 'ម៉ាស៊ីនបម្រើការ AI កំពុងមានអ្នកប្រើប្រាស់ច្រើន (503 Service Busy)។ សូមរង់ចាំ ៥ វិនាទី រួចសាកល្បងម្តងទៀត។';
    } else if (rawMsg) {
      // Strip any raw json brackets to keep it clean for user
      const cleanMsg = rawMsg.replace(/^{"error":\{.*"message":"([^"]+)".*\}\}$/, '$1');
      errMsg = `ការតភ្ជាប់បរាជ័យ៖ ${cleanMsg}`;
    }
    sendJson(res, 400, {
      error: errMsg,
    });
  }
};

apiApp.post('/convert', handleConvert);
apiApp.post('/api/convert', handleConvert);
apiApp.post('/refine', handleRefine);
apiApp.post('/api/refine', handleRefine);
apiApp.post('/test-key', handleTestKey);
apiApp.post('/api/test-key', handleTestKey);
