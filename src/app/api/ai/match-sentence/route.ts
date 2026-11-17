import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { pageText, word, meanings, imageBase64, mimeType } = await req.json();

    if ((!pageText && !imageBase64) || !word) {
      return NextResponse.json({ error: 'pageText or imageBase64 and word are required' }, { status: 400 });
    }

    const apiKey =
      req.headers.get('x-gemini-key') ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

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

    const prompt = `You are a strict, precise English-Korean bilingual linguist and visual document analyst.
Target Word: "${word}"

${hasImage ? 'PRIMARY SOURCE: Inspect the attached book/article page image directly with highest optical fidelity.' : ''}
${pageText ? `Reference Text:\n"""\n${pageText.slice(0, 5000)}\n"""` : ''}

Available Korean Dictionary Definitions:
${meaningsText}

CRITICAL INSTRUCTIONS:
1. Locate the target English word "${word}" (or its grammatical inflections: past tense, -ing, plural, comparative, irregular forms) ${hasImage ? 'directly in the IMAGE' : 'in the text'}.
2. If found, transcribe the EXACT, COMPLETE, UNCUT original sentence containing "${word}" with 100% optical accuracy (do NOT hallucinate, do NOT misspell, fix any hyphenated line-breaks naturally).
3. If "${word}" appears multiple times in different sentences, transcribe ALL matching sentences into "allMatches".
4. Determine the root base dictionary lemma (e.g. "prices" -> "price", "declined" -> "decline", "growing" -> "grow", "went" -> "go").
5. From the Available Korean Dictionary Definitions, select the best index for this context, with a concise 1-sentence explanation.
6. If the word does NOT appear, set "found": false.

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

    const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];

    const contentParts: any[] = [{ text: prompt }];
    if (hasImage && cleanBase64) {
      contentParts.push({
        inline_data: {
          mime_type: mimeType || 'image/jpeg',
          data: cleanBase64,
        },
      });
    }

    let data: any = null;
    let lastError: string = '';

    for (const model of candidateModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(9000),
          body: JSON.stringify({
            contents: [
              {
                parts: contentParts,
              },
            ],
            generationConfig: {
              temperature: 0.0,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (geminiRes.ok) {
          data = await geminiRes.json();
          break;
        } else {
          lastError = await geminiRes.text();
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
      }
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Gemini API request failed', details: lastError },
        { status: 502 }
      );
    }
    const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    try {
      const parsed = JSON.parse(rawJsonText);
      // 철저한 환각 검증: 반환된 문장 또는 본문에 실제로 단어나 형태소가 존재하는지 확인
      if (parsed.found && parsed.sentence) {
        const sentenceLower = String(parsed.sentence).toLowerCase();
        const wordLower = word.toLowerCase();
        const matchedLower = String(parsed.matchedWord || '').toLowerCase();

        // 문장 안에 targetWord 또는 matchedWord가 최소한 포함되어 있어야 유효!
        const isValid =
          sentenceLower.includes(wordLower) ||
          (matchedLower && sentenceLower.includes(matchedLower));

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
