import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export const apiApp = express();

export const SUPPORTED_MODELS = [
  {
    id: 'gemini-3.1-pro-preview',
    name: '3.1 Pro',
    tag: 'PRO',
    description: 'ស៊ីជម្រៅបំផុត (Deep Reasoning & Multimodal)',
    badgeColor: 'purple',
  },
  {
    id: 'gemini-3.8-flash',
    name: '3.8 Flash',
    tag: 'ឆ្លាតវៃបំផុត',
    description: 'ឆ្លាតវៃបំផុត យល់ច្បាស់ពីអារម្មណ៍ និងការសន្ទនាស្មុគស្មាញ',
    badgeColor: 'indigo',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: '3.1 Flash',
    tag: 'លឿនរហ័ស',
    description: 'ល្បឿនលឿនបំផុត ឆ្លើយតបរហ័ស និងជួយបញ្ចៀសការកកស្ទះម៉ាស៊ីនមេ',
    badgeColor: 'emerald',
  },
];

// Modern Google Gemini models active in production
const CANDIDATE_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-flash-latest'];

function resolveModel(modelName?: string): string {
  if (!modelName || modelName === 'auto') return 'gemini-3.1-flash-lite';
  if (modelName === 'gemini-2.5-flash') return 'gemini-3.1-flash-lite';
  if (modelName === '3.1 Pro' || modelName === '3.1-pro') return 'gemini-3.1-pro-preview';
  if (modelName === '3.8 Flash' || modelName === '3.8-flash') return 'gemini-3.8-flash';
  if (modelName === '3.1 Flash' || modelName === '3.1-flash') return 'gemini-3.1-flash-lite';
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
      mimeType = 'audio/wav',
      sourceLanguage = 'auto',
      style = 'natural',
      preferredModel = 'gemini-3.1-flash-lite',
    } = req.body || {};

    const ai = getGeminiClient(customApiKey || (req.headers['x-custom-api-key'] as string));
    if (!ai) {
      return sendJson(res, 500, {
        error: 'សូមកំណត់ GEMINI_API_KEY ជាមុនសិន។ (GEMINI_API_KEY is not configured)',
      });
    }

    if (!audioBase64) {
      return sendJson(res, 400, {
        error: 'មិនមានទិន្នន័យសំឡេងត្រូវបានផ្ញើមកទេ។ (No audio data provided)',
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

    const prompt = `
You are an expert audio transcriber and multilingual-to-Khmer dubbing translator.
${langNote}

Instructions:
1. Listen carefully to the supplied audio dialogue/speech.
2. Transcribe each spoken utterance in its original language.
3. ${styleNote}
4. Ensure segments are timed accurately to the audio timestamps (start and end in seconds).

Return ONLY valid JSON in this exact structure:
{
  "segments": [
    {
      "start": 0.0,
      "end": 2.5,
      "original": "original spoken sentence",
      "khmer": "អត្ថបទបកប្រែជាភាសាខ្មែរ"
    }
  ]
}

Strict Rules:
- "start" and "end" MUST be positive numbers in seconds (e.g. 1.25, 4.60).
- "end" MUST be strictly greater than "start".
- Keep segments chronological and concise (typically 2 to 7 seconds each for subtitle readability and dubbing rhythm).
- Faithfully preserve names, emotional tone, and intent.
- Do NOT fabricate dialogue that does not exist in the audio.
- If speech in a segment is unclear, write "[មិនច្បាស់]" for that part.
- Do NOT include music notes or ambient noise annotations like [Sound Effect].
- Output valid JSON only, without markdown fences or additional explanation.
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

    const segments = parsed.segments
      .filter((s: any) =>
        Number.isFinite(Number(s.start)) &&
        Number.isFinite(Number(s.end)) &&
        Number(s.start) >= 0 &&
        Number(s.end) > Number(s.start) &&
        String(s.khmer || '').trim()
      )
      .map((s: any, i: number) => ({
        id: i + 1,
        start: Math.round(Number(s.start) * 100) / 100,
        end: Math.round(Number(s.end) * 100) / 100,
        original: String(s.original || '').trim(),
        text: String(s.khmer || '').trim(),
      }))
      .sort((a: any, b: any) => a.start - b.start);

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
      warning: 'ពេលវេលាត្រូវបានប៉ាន់ស្មានដោយ AI។ អ្នកអាចកែសម្រួលបន្ថែមក្នុងផ្ទាំងកែសម្រួលមុនពេលទាញយក។',
    });
  } catch (error: any) {
    console.error('Error in /api/convert:', error);
    let rawMsg = String(error?.message || '');

    let userMessage = 'មានបញ្ហាក្នុងការបម្លែងវីដេអូ។ សូមព្យាយាមម្តងទៀត។';
    if (rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE')) {
      userMessage =
        'ម៉ាស៊ីន AI កំពុងមានអ្នកប្រើប្រាស់ច្រើនក្នុងពេលដំណាលគ្នា (503 High Demand)។ សូមរង់ចាំ ៥-១០ វិនាទី រួចចុច "បម្លែងទៅជាអត្ថបទខ្មែរ" ម្តងទៀត ឬជ្រើសរើស Gemini 3.1 Flash Lite។';
    } else if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      userMessage =
        'បានលើសកម្រិតកំណត់សំណើ (429 Rate Limit)។ សូមរង់ចាំបន្តិច រួចព្យាយាមម្តងទៀត។';
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
    const { customApiKey, text, original, model = 'gemini-3.1-flash-lite' } = req.body || {};
    const ai = getGeminiClient(customApiKey || (req.headers['x-custom-api-key'] as string));
    if (!ai) {
      return sendJson(res, 500, { error: 'សូមកំណត់ GEMINI_API_KEY ជាមុនសិន' });
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
    sendJson(res, 500, { error: err.message || 'មិនអាចកែប្រែបានទេ' });
  }
};

// Test API Key endpoint requested by user
const handleTestKey = async (req: Request, res: Response) => {
  try {
    const { customApiKey, model = 'gemini-3.1-flash-lite' } = req.body || {};
    const ai = getGeminiClient(customApiKey || (req.headers['x-custom-api-key'] as string));
    if (!ai) {
      return sendJson(res, 400, {
        error: 'មិនមាន API Key ត្រឹមត្រូវទេ (No API Key)',
      });
    }

    const resolved = resolveModel(model);
    const start = Date.now();
    const config: any = { temperature: 0.1 };
    if (resolved.includes('gemini-3')) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }

    await ai.models.generateContent({
      model: resolved,
      contents: 'Ping test',
      config,
    });

    const latency = Date.now() - start;
    sendJson(res, 200, {
      ok: true,
      latency,
      modelUsed: resolved,
      message: `ការតភ្ជាប់ជោគជ័យ 100%! ល្បឿនឆ្លើយតប: ${(latency / 1000).toFixed(2)}s`,
    });
  } catch (err: any) {
    sendJson(res, 400, {
      error: err?.message || 'ការតភ្ជាប់បរាជ័យ (Connection failed)',
    });
  }
};

apiApp.post('/convert', handleConvert);
apiApp.post('/api/convert', handleConvert);
apiApp.post('/refine', handleRefine);
apiApp.post('/api/refine', handleRefine);
apiApp.post('/test-key', handleTestKey);
apiApp.post('/api/test-key', handleTestKey);
