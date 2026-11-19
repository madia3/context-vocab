import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithFallback, checkRateLimit, resolveServerGeminiKeyAsync } from '@/lib/geminiServer';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, 30);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } }
      );
    }

    const { sentence, word, nextPageText } = await req.json();

    if (!sentence || typeof sentence !== 'string' || !sentence.trim()) {
      return NextResponse.json({ error: 'Sentence is required' }, { status: 400 });
    }

    const safeSentence = sentence.trim().slice(0, 1000);
    const safeWord = typeof word === 'string' ? word.trim().slice(0, 60) : '';
    const safeNextPage = typeof nextPageText === 'string' ? nextPageText.trim().slice(0, 1000) : '';

    const apiKey = await resolveServerGeminiKeyAsync(req);

    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 401 });
    }

    const hasNextPage = Boolean(safeNextPage && safeNextPage.length > 5);

    const prompt = hasNextPage
      ? `You are an expert English book editor and lexicographer.
A reader took a photo of a book/article page, but a sentence was cut off across the page bottom boundary.
The reader has now taken a photo of the NEXT page.

1. Cut-off Sentence Fragment from Previous Page:
"""
${safeSentence}
"""

2. Beginning of the Next Page:
"""
${safeNextPage}
"""

Target Vocabulary Word: "${safeWord}"

TASK:
1. Carefully inspect the beginning of the next page to see if and how the sentence fragment naturally continues.
2. If it continues onto the next page:
   - Stitch the fragment with its exact continuation from the next page into ONE complete, authentic, continuous English sentence.
   - If the fragment ended with a hyphenated word break (e.g. "comprehen-" and next page begins with "sive"), join them cleanly into "comprehensive".
   - Only take the continuation up to its terminal punctuation (. ! ?). Do NOT include subsequent unrelated sentences.
   - Set "didStitchNextPage": true.
3. If the next page does NOT appear to continue this sentence, complete the sentence fragment naturally on its own and set "didStitchNextPage": false.
4. Provide a natural, elegant Korean translation of the completed full sentence in "sentenceTranslation".

Output strictly valid JSON:
{
  "completedSentence": "Complete stitched English sentence...",
  "sentenceTranslation": "자연스러운 한국어 문장 해석...",
  "didStitchNextPage": true
}`
      : `You are an expert English editor and lexicographer.
A reader took a photo of a book/article page, but the sentence was cut off across page boundaries or margin limits.

Incomplete Sentence Fragment:
"""
${safeSentence}
"""

Target Vocabulary Word: "${safeWord}"

TASK:
1. Complete the cut-off sentence naturally and grammatically, preserving the existing words as much as possible.
2. If the beginning was cut off (e.g. starts with lowercase or mid-clause), add a natural beginning clause.
3. If the end was cut off (e.g. ends abruptly without a period, or ends with a conjunction/preposition), complete the clause with a plausible, natural, elegant ending.
4. The target word "${safeWord}" must remain naturally inside the sentence.
5. Provide a natural Korean translation of the completed sentence.

Output strictly valid JSON:
{
  "completedSentence": "Complete natural English sentence ending with . ? !",
  "sentenceTranslation": "자연스러운 한국어 해석",
  "didStitchNextPage": false
}`;

    const aiRes = await callGeminiWithFallback({
      apiKey,
      endpoint: 'complete-sentence',
      parts: [{ text: prompt }],
      temperature: 0.2,
      responseMimeType: 'application/json',
      maxOutputTokens: 350,
      req,
    });

    if (aiRes.quotaExceeded) {
      return NextResponse.json(
        {
          error: aiRes.lastError || '오늘의 무료 서버 AI 한도를 모두 사용했습니다.',
          code: 'SERVER_QUOTA_EXCEEDED',
          quotaInfo: aiRes.quotaInfo,
        },
        { status: 429 }
      );
    }

    let completedText = '';
    let sentenceTranslation = '';
    let didStitchNextPage = false;

    if (aiRes.ok && aiRes.text) {
      try {
        const cleanJson = aiRes.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (parsed.completedSentence && typeof parsed.completedSentence === 'string') {
          completedText = parsed.completedSentence.trim();
        }
        if (parsed.sentenceTranslation && typeof parsed.sentenceTranslation === 'string') {
          sentenceTranslation = parsed.sentenceTranslation.trim();
        }
        if (typeof parsed.didStitchNextPage === 'boolean') {
          didStitchNextPage = parsed.didStitchNextPage;
        }
      } catch {
        completedText = aiRes.text.replace(/^["'`]|["'`]$/g, '').trim();
      }
    }

    if (!completedText) {
      completedText = safeSentence;
      if (!/[.!?]$/.test(completedText)) {
        completedText += '.';
      }
    }

    return NextResponse.json({
      completedSentence: completedText,
      sentenceTranslation,
      didStitchNextPage,
    });
  } catch (err: any) {
    console.error('Sentence completion error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to complete sentence' },
      { status: 500 }
    );
  }
}
