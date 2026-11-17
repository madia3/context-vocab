// Shared server-side Gemini API model configuration & fast fallback caller
// Optimized to avoid 503/404 models and minimize thinking latency on Vercel serverless functions

export interface GeminiModelCandidate {
  model: string;
  thinkingConfig?: Record<string, any>;
  timeoutMs: number;
}

// Live-verified fast models on Google Generative Language v1beta API
export const FAST_GEMINI_CANDIDATES: GeminiModelCandidate[] = [
  {
    model: 'gemini-3.5-flash-lite',
    thinkingConfig: { thinkingLevel: 'LOW' },
    timeoutMs: 4800,
  },
  {
    model: 'gemini-3.1-flash-lite',
    thinkingConfig: { thinkingBudget: 0 },
    timeoutMs: 4200,
  },
  {
    model: 'gemini-flash-lite-latest',
    thinkingConfig: { thinkingLevel: 'LOW' },
    timeoutMs: 4200,
  },
  {
    model: 'gemini-3.5-flash',
    thinkingConfig: { thinkingLevel: 'LOW' },
    timeoutMs: 4500,
  },
];

export async function callGeminiWithFallback(options: {
  apiKey: string;
  parts: any[];
  temperature?: number;
  responseMimeType?: string;
  maxOutputTokens?: number;
  candidates?: GeminiModelCandidate[];
}): Promise<{ ok: boolean; text: string; rawData?: any; modelUsed?: string; lastError?: string }> {
  const {
    apiKey,
    parts,
    temperature = 0.0,
    responseMimeType = 'application/json',
    maxOutputTokens,
    candidates = FAST_GEMINI_CANDIDATES,
  } = options;

  let lastError = '';

  for (const candidate of candidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate.model}:generateContent?key=${apiKey}`;
      const generationConfig: Record<string, any> = {
        temperature,
      };
      if (responseMimeType) {
        generationConfig.responseMimeType = responseMimeType;
      }
      if (typeof maxOutputTokens === 'number') {
        generationConfig.maxOutputTokens = maxOutputTokens;
      }
      if (candidate.thinkingConfig) {
        generationConfig.thinkingConfig = candidate.thinkingConfig;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(candidate.timeoutMs),
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          return {
            ok: true,
            text,
            rawData: data,
            modelUsed: candidate.model,
          };
        }
      } else {
        lastError = await res.text();
        // If 400 Invalid Argument due to thinkingConfig on an alias model, retry immediately without thinkingConfig
        if (res.status === 400 && candidate.thinkingConfig) {
          const retryGenConfig: Record<string, any> = { temperature };
          if (responseMimeType) retryGenConfig.responseMimeType = responseMimeType;
          if (typeof maxOutputTokens === 'number') retryGenConfig.maxOutputTokens = maxOutputTokens;

          const retryRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(candidate.timeoutMs),
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: retryGenConfig,
            }),
          });
          if (retryRes.ok) {
            const retryData = await retryRes.json();
            const retryText = retryData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (retryText) {
              return {
                ok: true,
                text: retryText,
                rawData: retryData,
                modelUsed: candidate.model,
              };
            }
          }
        }
      }
    } catch (err: any) {
      lastError = err?.message || String(err);
    }
  }

  return {
    ok: false,
    text: '',
    lastError,
  };
}
