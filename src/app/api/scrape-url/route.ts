import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// HTML에서 불필요한 태그를 제거하고 순수 텍스트와 본문 문장들을 추출하는 유틸리티
function cleanHtmlContent(html: string): { title: string; cleanText: string } {
  // 1. 타이틀 추출
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  let title = titleMatch ? titleMatch[1].trim() : '';
  // HTML 엔티티 제거 (간단 디코딩)
  title = title
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('|')[0]
    .split(' - ')[0]
    .trim();

  // 2. 불필요한 태그 제거 (스크립트, 스타일, 헤더, 푸터, 내비게이션, 광고 등)
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // 3. article이나 main 태그가 있는 경우 우선 추출
  const articleMatch = text.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = text.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const targetContent = articleMatch ? articleMatch[1] : mainMatch ? mainMatch[1] : text;

  // 4. p, h1~h6, li, blockquote 태그 뒤에 줄바꿈 추가
  let extracted = targetContent
    .replace(/<\/(p|div|h[1-6]|li|blockquote|section|tr)>/gi, '\n\n')
    .replace(/<br\s*[\/]?>/gi, '\n');

  // 5. 남은 모든 HTML 태그 제거
  extracted = extracted.replace(/<[^>]+>/g, ' ');

  // 6. 엔티티 디코딩 및 공백 정리
  extracted = extracted
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

  // 문장다운 문단들만 필터링 (최소 20자 이상, 영문 포함)
  const paragraphs = extracted
    .split('\n\n')
    .map((p) => p.trim())
    .filter((p) => p.length >= 25 && /[a-zA-Z]{3,}/.test(p));

  return {
    title: title || '웹페이지 발췌 기사',
    cleanText: paragraphs.join('\n\n'),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: '웹페이지 주소(URL)를 입력해 주세요.' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return NextResponse.json({ error: '올바른 웹페이지 URL 형식이 아닙니다.' }, { status: 400 });
    }

    // 웹페이지 HTML 가져오기 (User-Agent 포함)
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `웹페이지를 불러오지 못했습니다. (HTTP 상태코드: ${response.status})` },
        { status: 400 }
      );
    }

    const html = await response.text();
    const { title, cleanText } = cleanHtmlContent(html);

    if (!cleanText || cleanText.length < 50) {
      return NextResponse.json(
        { error: '해당 웹페이지에서 읽어올 수 있는 영문 본문 텍스트를 찾지 못했습니다.' },
        { status: 422 }
      );
    }

    // 대략적인 문장 개수 추정
    const sentences = cleanText
      .split(/(?<=[.?!])\s+(?=[A-Z"'])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15);

    // AI API 키가 있다면, Gemini를 이용해 더 깔끔한 핵심 기사 본문으로 정제 (선택사항)
    const apiKey =
      req.headers.get('x-gemini-key') ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    let finalCleanText = cleanText;

    if (apiKey && cleanText.length > 500) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
        const prompt = `You are an expert reading assistant. Clean the extracted web article text below.
Remove all leftover website UI debris, cookie notices, author bios, social media links, and unrelated captions.
Keep only the coherent, full English article paragraphs and sentences in order. Do not translate.

Raw Text:
${cleanText.slice(0, 8000)}`;

        const aiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 2500 },
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const aiResultText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiResultText && aiResultText.trim().length > 100) {
            finalCleanText = aiResultText.trim();
          }
        }
      } catch (e) {
        console.warn('Gemini web cleanup skipped, using rule-based clean text:', e);
      }
    }

    return NextResponse.json({
      ok: true,
      title: title || parsedUrl.hostname,
      text: finalCleanText,
      sentenceCount: sentences.length,
      sourceUrl: parsedUrl.toString(),
      hostname: parsedUrl.hostname,
    });
  } catch (err: any) {
    console.error('URL Scrape Error:', err);
    return NextResponse.json(
      { error: err.message || '웹페이지를 분석하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
