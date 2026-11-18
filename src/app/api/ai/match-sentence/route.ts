import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithFallback, checkRateLimit, resolveServerGeminiKey } from '@/lib/geminiServer';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, 40);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } }
      );
    }

    const { pageText, word, meanings, imageBase64, mimeType, contextHint } = await req.json();

    if ((!pageText && !imageBase64) || !word || typeof word !== 'string') {
      return NextResponse.json({ error: 'pageText or imageBase64 and word are required' }, { status: 400 });
    }

    if (imageBase64 && typeof imageBase64 === 'string' && imageBase64.length > 12_000_000) {
      return NextResponse.json({ error: 'Image payload too large' }, { status: 413 });
    }

    const apiKey = resolveServerGeminiKey(req);

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API Key is not configured' },
        { status: 401 }
      );
    }

    const hasMeanings = Array.isArray(meanings) && meanings.length > 0;
    const meaningsText = hasMeanings
      ? meanings.map((m: any, idx: number) => `[${idx}] (${m.pos || '품사'}) ${m.def}`).join('\n')
      : 'None provided';

    const hasImage = Boolean(imageBase64 && typeof imageBase64 === 'string' && imageBase64.length > 50);
    const cleanBase64 = hasImage ? imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '') : '';

    const buildPrompt = (withImage: boolean) => `You are a strict, precise English-Korean bilingual linguist and visual document analyst.
Target Word (or OCR Fragment): "${word}"
${contextHint ? `Tapped Context Snippet (where user clicked [[${word}]]):\n"""\n${String(contextHint).slice(0, 400)}\n"""\n` : ''}
${withImage ? 'PRIMARY SOURCE: Inspect the attached book/article page image directly with highest optical fidelity.' : ''}
${pageText ? `Reference Text:\n"""\n${String(pageText).slice(0, 5000)}\n"""` : ''}

Available Korean Dictionary Definitions:
${meaningsText}

CRITICAL INSTRUCTIONS:
1. Locate the target English word "${word}" (or its grammatical inflections: past tense, -ing, plural, comparative, irregular forms) ${withImage ? 'directly in the IMAGE' : 'in the text'}.
2. OCR MISREAD RECOVERY (VERY IMPORTANT):
   - If "${word}" is a corrupted/truncated OCR fragment (e.g. "categor" -> "categories", "jike" -> "like", "lishing" -> "publishing", "ee"/"bleue"/"tions" in "As you consider [[Ee]]..." -> "questions" or "these"), inspect the Tapped Context Snippet ${withImage ? 'and the original IMAGE ' : ''}at that exact sentence location to identify the TRUE intended English word!
   - Set "lemma" to the restored base dictionary word (e.g. "category", "like", "publish", "question") and "matchedWord" to the exact word in the sentence.
3. Transcribe the EXACT, COMPLETE, UNCUT original sentence containing the word with 100% accuracy (do NOT hallucinate, fix any OCR typos or hyphenated line-breaks naturally).
4. If the word appears multiple times in different sentences, transcribe ALL matching sentences into "allMatches".
5. Select the best Korean definition index for this context (or provide the accurate contextual Korean meaning in "bestMeaningDef" and part-of-speech in "bestPos" if the word was recovered from an OCR typo), with a concise 1-sentence explanation in "aiExplanation".
6. If the word does NOT appear at all, set "found": false.

Return strictly valid JSON:
{
  "found": true,
  "lemma": "base lemma",
  "sentence": "Exact complete sentence",
  "matchedWord": "exact word form found",
  "allMatches": [
    { "sentence": "Exact complete sentence 1", "matchedWord": "word1" }
  ],
  "bestMeaningIndex": 0,
  "bestMeaningDef": "가장 어울리는 한국어 뜻",
  "bestPos": "품사",
  "aiExplanation": "이 문맥에서는 ~라는 의미로 쓰였습니다."
}`;

    let rawJsonText = '';

    // 1. 이미지가 있으면 초고속 Vision 모델 우선 시도 (thinkingLevel: LOW / thinkingBudget: 0)
    if (hasImage && cleanBase64) {
      const visionRes = await callGeminiWithFallback({
        apiKey,
        parts: [
          { text: buildPrompt(true) },
          {
            inline_data: {
              mime_type: mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
        ],
        temperature: 0.0,
        responseMimeType: 'application/json',
        candidates: [
          { model: 'gemini-2.5-flash-lite', thinkingConfig: { thinkingBudget: 0 }, timeoutMs: 4500 },
          { model: 'gemini-2.0-flash', timeoutMs: 4000 },
        ],
      });

      if (visionRes.ok && visionRes.text) {
        rawJsonText = visionRes.text;
      }
    }

    // 2. Vision 호출이 실패했거나 이미지가 없는 경우: 초고속(1.2초) 텍스트 기반 문맥 복원 및 매칭 즉시 실행
    if (!rawJsonText && pageText) {
      const textRes = await callGeminiWithFallback({
        apiKey,
        parts: [{ text: buildPrompt(false) }],
        temperature: 0.0,
        responseMimeType: 'application/json',
      });
      if (textRes.ok && textRes.text) {
        rawJsonText = textRes.text;
      }
    }

    if (!rawJsonText) {
      return NextResponse.json(
        { error: 'Gemini API request failed' },
        { status: 502 }
      );
    }

    try {
      const cleanJson = rawJsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      // 철저한 환각 검증: 반환된 문장 또는 본문에 실제로 단어나 형태소가 존재하는지 확인
      if (parsed.found && parsed.sentence) {
        const sentenceLower = String(parsed.sentence).toLowerCase();
        const wordLower = word.toLowerCase();
        const matchedLower = String(parsed.matchedWord || '').toLowerCase();
        const lemmaLower = String(parsed.lemma || '').toLowerCase();

        // 문장 안에 targetWord, matchedWord, 또는 복원된 lemma가 포함되어 있어야 유효!
        const isValid =
          sentenceLower.includes(wordLower) ||
          (matchedLower && sentenceLower.includes(matchedLower)) ||
          (lemmaLower && sentenceLower.includes(lemmaLower));

        if (!isValid) {
          console.warn(`AI Hallucination blocked: "${word}" matched unrelated sentence: "${parsed.sentence}"`);
          return NextResponse.json({ found: false, sentence: '', matchedWord: '', allMatches: [] });
        }

        // 중복 문장 완전 제거 (공백/따옴표/특수문자 정규화 기준)
        const seenNorm = new Set<string>();
        const dedupedMatches: { sentence: string; matchedWord?: string }[] = [];

        const primarySent = String(parsed.sentence || '').trim();
        const normPrimary = primarySent.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (primarySent && normPrimary.length > 5) {
          seenNorm.add(normPrimary);
          dedupedMatches.push({
            sentence: primarySent,
            matchedWord: parsed.matchedWord,
          });
        }

        if (Array.isArray(parsed.allMatches)) {
          for (const m of parsed.allMatches) {
            const s = String(m?.sentence || '').trim();
            const norm = s.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (s && norm.length > 5 && !seenNorm.has(norm)) {
              seenNorm.add(norm);
              dedupedMatches.push({
                sentence: s,
                matchedWord: m.matchedWord || parsed.matchedWord,
              });
            }
          }
        }

        parsed.sentence = primarySent;
        parsed.allMatches = dedupedMatches;
      }
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ found: false, sentence: '', matchedWord: '', allMatches: [] });
    }
  } catch (err: any) {
    console.error('Match Sentence API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
