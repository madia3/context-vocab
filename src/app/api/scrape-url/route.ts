import { NextRequest, NextResponse } from 'next/server';
import dns from 'dns/promises';
import { cleanArticleTextHeuristic } from '@/lib/cleanText';
import { callGeminiWithFallback, checkRateLimit, resolveServerGeminiKey } from '@/lib/geminiServer';

export const runtime = 'nodejs';

function isPrivateIpAddress(ipRaw: string): boolean {
  const ip = ipRaw.toLowerCase().trim().replace(/^\[|\]$/g, '');
  if (!ip) return true;

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  if (ip.startsWith('::ffff:')) {
    return isPrivateIpAddress(ip.slice(7));
  }

  // IPv6 loopback, unspecified, unique-local (fc00::/7), link-local (fe80::/10)
  if (ip.includes(':')) {
    return (
      ip === '::1' ||
      ip === '::' ||
      ip.startsWith('fc') ||
      ip.startsWith('fd') ||
      ip.startsWith('fe8') ||
      ip.startsWith('fe9') ||
      ip.startsWith('fea') ||
      ip.startsWith('feb')
    );
  }

  // IPv4 private / loopback / link-local / CGNAT / broadcast
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // Carrier-grade NAT
    if (a >= 224) return true; // Multicast / Reserved
  }

  return false;
}

function isPrivateOrInternalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim().replace(/^\[|\]$/g, '');
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost') ||
    /^\d+$/.test(host) || // Integer IP representation (e.g. 2130706433)
    /^0x[0-9a-f]+/i.test(host) // Hex IP representation
  ) {
    return true;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) {
    return isPrivateIpAddress(host);
  }
  return false;
}

async function isUnsafeResolvedHost(hostname: string): Promise<boolean> {
  if (isPrivateOrInternalHost(hostname)) return true;
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0) return false;
    return records.some((r) => isPrivateIpAddress(r.address));
  } catch {
    return false;
  }
}

// 빠른 응답을 위한 메모리 캐시 (10분 TTL)
interface CacheEntry {
  title: string;
  text: string;
  sentenceCount: number;
  sourceUrl: string;
  hostname: string;
  timestamp: number;
}
const urlCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&#(\d+);/g, (_, code) => {
      try {
        return String.fromCharCode(parseInt(code, 10));
      } catch {
        return '';
      }
    });
}

function extractTitle(html: string): string {
  // 1. og:title 또는 twitter:title (뉴스/블로그의 가장 깔끔한 헤드라인)
  const ogTitleMatch =
    html.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i) ||
    html.match(/<meta\b[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i);

  let rawTitle = ogTitleMatch ? ogTitleMatch[1] : '';

  // 2. <title> 태그
  if (!rawTitle) {
    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTagMatch) rawTitle = titleTagMatch[1];
  }

  // 3. <h1> 태그
  if (!rawTitle) {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) rawTitle = h1Match[1].replace(/<[^>]+>/g, '');
  }

  if (!rawTitle) return '';

  let clean = decodeHtmlEntities(rawTitle).trim();
  // 사이트 이름 접미사 제거 (예: "Article Headline | BBC News" -> "Article Headline")
  clean = clean
    .split(/\s+[|\-–—]\s+[A-Za-z0-9]/)[0]
    .replace(/\s*-\s*[A-Za-z0-9\s]+$/, '')
    .trim();

  return clean;
}

// JSON-LD 구조화 데이터에서 articleBody 추출 (주요 언론사 지원)
function extractJsonLdArticleBody(html: string): string {
  try {
    const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      const content = match[1]?.trim();
      if (!content || !content.includes('articleBody')) continue;
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed.articleBody === 'string' && parsed.articleBody.length > 100) {
          return parsed.articleBody;
        }
        if (Array.isArray(parsed['@graph'])) {
          for (const item of parsed['@graph']) {
            if (typeof item?.articleBody === 'string' && item.articleBody.length > 100) {
              return item.articleBody;
            }
          }
        }
      } catch {
        // 일부 JSON 파싱 에러 시 다음 스크립트 계속 탐색
      }
    }
  } catch {}
  return '';
}

// 고속 고품질 HTML 본문 추출 함수 (0.01초 이내 처리)
function cleanHtmlContentFast(html: string): { title: string; cleanText: string } {
  const title = extractTitle(html);

  // 1. JSON-LD에 정제된 articleBody가 있다면 최우선 활용 (광고/UI 오염 0%)
  const jsonLdBody = extractJsonLdArticleBody(html);
  if (jsonLdBody && jsonLdBody.length >= 150) {
    const { cleanedText } = cleanArticleTextHeuristic(jsonLdBody);
    if (cleanedText.length >= 100) {
      return {
        title: title || '웹페이지 기사',
        cleanText: cleanedText,
      };
    }
  }

  // 2. 불필요한 태그 및 광고 컨테이너 1차 제거
  let cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // 3. 광고/쿠키/SNS 위젯 컨테이너 태그 제거
  cleanHtml = cleanHtml.replace(
    /<(div|section|aside|p)\b[^>]*(?:class|id)=["'][^"']*\b(ad|ads|advertisement|banner|cookie|popup|modal|social-share|sidebar|newsletter|comment|comments)\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
    ' '
  );

  // 4. article 또는 main 본문 영역 우선 추출
  const articleMatch = cleanHtml.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = cleanHtml.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const targetContent = articleMatch ? articleMatch[1] : mainMatch ? mainMatch[1] : cleanHtml;

  // 5. 문단/문장 구분을 위해 블록 태그 뒤 줄바꿈 삽입
  let extracted = targetContent
    .replace(/<\/(p|div|h[1-6]|li|blockquote|section|tr)>/gi, '\n\n')
    .replace(/<br\s*[\/]?>/gi, '\n');

  // 6. 모든 잔여 HTML 태그 제거 및 엔티티 디코딩
  extracted = extracted.replace(/<[^>]+>/g, ' ');
  extracted = decodeHtmlEntities(extracted);

  // 7. 공백 및 줄바꿈 정리
  extracted = extracted
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

  // 8. 광고/구독/소셜 휴리스틱 필터링 적용 (광고 문구 즉시 정제)
  const { cleanedText } = cleanArticleTextHeuristic(extracted);

  // 9. 문장다운 문단들만 수집 (길이 25자 이상, 영문 단어 포함)
  const paragraphs = cleanedText
    .split('\n\n')
    .map((p) => p.trim())
    .filter((p) => p.length >= 25 && /[a-zA-Z]{3,}/.test(p));

  return {
    title: title || '웹페이지 기사',
    cleanText: paragraphs.join('\n\n'),
  };
}

export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, 30);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } }
      );
    }

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

    // SSRF 보안 방어: http/https 프로토콜만 허용 및 로컬/사설망/메타데이터 주소 차단
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'http 또는 https 웹페이지만 불러올 수 있습니다.' }, { status: 400 });
    }

    if (await isUnsafeResolvedHost(parsedUrl.hostname)) {
      return NextResponse.json({ error: '보안 정책상 내부망이나 로컬 주소는 접근할 수 없습니다.' }, { status: 403 });
    }

    const cacheKey = parsedUrl.toString();
    const cached = urlCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        ok: true,
        title: cached.title,
        text: cached.text,
        sentenceCount: cached.sentenceCount,
        sourceUrl: cached.sourceUrl,
        hostname: cached.hostname,
        fromCache: true,
      });
    }

    // 리다이렉트(301/302/303/307/308) 수동 추적 및 매 홉마다 SSRF/DNS 선검증 (최대 5회)
    let currentFetchUrl = parsedUrl;
    let response: Response | null = null;
    const MAX_REDIRECTS = 5;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      response = await fetch(currentFetchUrl.toString(), {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
          'Cache-Control': 'no-cache',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const locationHeader = response.headers.get('location');
        if (!locationHeader) break;
        if (hop === MAX_REDIRECTS) {
          return NextResponse.json(
            { error: '리다이렉트 횟수가 너무 많습니다. 최종 페이지 주소를 직접 입력해 주세요.' },
            { status: 400 }
          );
        }

        let nextUrl: URL;
        try {
          nextUrl = new URL(locationHeader, currentFetchUrl);
        } catch {
          return NextResponse.json({ error: '잘못된 리다이렉트 주소입니다.' }, { status: 400 });
        }

        if (
          (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') ||
          (await isUnsafeResolvedHost(nextUrl.hostname))
        ) {
          return NextResponse.json(
            { error: '보안 정책상 내부망으로 리다이렉트되는 주소는 접근할 수 없습니다.' },
            { status: 403 }
          );
        }

        currentFetchUrl = nextUrl;
        continue;
      }

      break;
    }

    if (!response || !response.ok) {
      return NextResponse.json(
        { error: `웹페이지를 불러오지 못했습니다. (HTTP 상태코드: ${response?.status || 500})` },
        { status: 400 }
      );
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (
      contentType &&
      !contentType.includes('text/html') &&
      !contentType.includes('text/plain') &&
      !contentType.includes('application/xhtml+xml') &&
      !contentType.includes('application/xml')
    ) {
      return NextResponse.json(
        { error: '웹 문서(HTML/텍스트) 형식의 주소만 불러올 수 있습니다.' },
        { status: 415 }
      );
    }

    const contentLength = Number(response.headers.get('content-length') || '0');
    if (contentLength > 2_500_000) {
      return NextResponse.json(
        { error: '웹페이지 용량이 너무 큽니다. 본문 텍스트를 직접 복사해서 붙여넣어 주세요.' },
        { status: 413 }
      );
    }

    // 스트림 리더로 최대 2MB까지만 안전하게 읽어 대용량 응답 폭탄(OOM) 차단
    const MAX_HTML_BYTES = 2_000_000;
    let html = '';
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let receivedBytes = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            receivedBytes += value.byteLength;
            if (receivedBytes > MAX_HTML_BYTES) {
              const allowedSlice = value.subarray(0, Math.max(0, value.byteLength - (receivedBytes - MAX_HTML_BYTES)));
              html += decoder.decode(allowedSlice, { stream: false });
              await reader.cancel().catch(() => {});
              break;
            }
            html += decoder.decode(value, { stream: true });
          }
        }
        html += decoder.decode();
      } finally {
        reader.releaseLock();
      }
    } else {
      const rawHtml = await response.text();
      html = rawHtml.length > MAX_HTML_BYTES ? rawHtml.slice(0, MAX_HTML_BYTES) : rawHtml;
    }

    // 초고속 규칙/휴리스틱 기반 기사 본문 추출 (약 10ms 소요)
    const { title, cleanText } = cleanHtmlContentFast(html);

    let finalCleanText = cleanText;

    // 만약 규칙 기반 추출로 충분한 본문(80자 이상)을 찾았다면, 느린 AI 호출 없이 즉시 반환! (0.3~0.7초 만에 완료)
    if (!finalCleanText || finalCleanText.length < 80) {
      // 규칙 기반 추출 실패 시(특수한 SPA 구조 등)에만 초고속 Gemini Lite 모델로 긴급 복구
      const apiKey = resolveServerGeminiKey(req);

      if (apiKey && html.length > 200) {
        try {
          const prompt = `Extract only the main English article paragraphs from this web page HTML. Ignore navigation, footer, ads, and cookies. Do not translate. Return plain text paragraphs only.\n\nHTML:\n${html.slice(0, 10000)}`;
          const aiRes = await callGeminiWithFallback({
            apiKey,
            parts: [{ text: prompt }],
            responseMimeType: 'text/plain',
            maxOutputTokens: 1200,
          });

          if (aiRes.ok && aiRes.text.trim().length > 60) {
            finalCleanText = aiRes.text.trim();
          }
        } catch (e) {
          console.warn('Fast AI web fallback failed:', e);
        }
      }
    }

    if (!finalCleanText || finalCleanText.length < 40) {
      return NextResponse.json(
        { error: '해당 웹페이지에서 읽어올 수 있는 영문 본문 텍스트를 찾지 못했습니다.' },
        { status: 422 }
      );
    }

    // 대략적인 문장 개수 산출
    const sentences = finalCleanText
      .split(/(?<=[.?!])\s+(?=[A-Z"'])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15);

    const resultData = {
      ok: true,
      title: title || parsedUrl.hostname,
      text: finalCleanText,
      sentenceCount: sentences.length,
      sourceUrl: parsedUrl.toString(),
      hostname: parsedUrl.hostname,
    };

    // 캐시에 저장하여 이후 중복 조회 시 즉각 응답
    urlCache.set(cacheKey, {
      ...resultData,
      timestamp: Date.now(),
    });

    return NextResponse.json(resultData);
  } catch (err: any) {
    console.error('URL Scrape Error:', err);
    if (err.name === 'TimeoutError' || err.message?.includes('timeout') || err.message?.includes('aborted')) {
      return NextResponse.json(
        { error: '웹페이지 응답 시간이 초과되었습니다. 다른 URL을 시도하거나 본문 글 붙여넣기를 이용해 주세요.' },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: err.message || '웹페이지를 분석하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
