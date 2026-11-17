// 광고/구독/SNS 노이즈 정제 유틸리티

export const AD_PATTERNS = [
  /^\s*advertisement\s*$/i,
  /^\s*ad\s*$/i,
  /^\s*sponsored\s*(by|content)?/i,
  /^\s*subscribe(\s+now|\s+today|\s+for\s+free|\s+to\s+read|\s+for\s+[\d$€£]+)?/i,
  /^\s*sign\s+up\s+(for|to)/i,
  /^\s*newsletter\s*(sign\s*up)?/i,
  /^\s*read\s+more[:\s]/i,
  /^\s*related\s+(articles?|stories?|topics?|reading)/i,
  /^\s*more\s+on\s+this\s+story/i,
  /^\s*share\s+(this\s+article|on\s+twitter|on\s+facebook|via\s+email|this)/i,
  /^\s*follow\s+us\s+on/i,
  /^\s*(photo|image|illustration|video|graphics?)\s*(credit|by)?[:\s]/i,
  /^\s*getty\s*images/i,
  /^\s*reuters\s*$/i,
  /^\s*associated\s*press\s*$/i,
  /^\s*all\s+rights\s+reserved/i,
  /^\s*copyright\s*(©|\(c\))?/i,
  /^\s*terms\s+of\s+(service|use)/i,
  /^\s*privacy\s+policy/i,
  /^\s*cookie\s+settings/i,
  /^\s*loading\s*\.{0,3}\s*$/i,
  /^\s*click\s+here\s+to/i,
  /^\s*download\s+the\s+app/i,
  /^\s*log\s*in\s+to\s+continue/i,
  /^\s*already\s+a\s+subscriber\?/i,
  /^\s*view\s+comments/i,
  /^\s*leave\s+a\s+comment/i,
];

// 규칙 기반 뉴스 기사 본문 정제
export function cleanArticleTextHeuristic(text: string): { cleanedText: string; removedCount: number } {
  if (!text) return { cleanedText: '', removedCount: 0 };

  const lines = text.split(/\r?\n/);
  let removedCount = 0;
  const filteredLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (filteredLines.length > 0 && filteredLines[filteredLines.length - 1] !== '') {
        filteredLines.push('');
      }
      continue;
    }

    // 광고/구독/바이라인 패턴 매칭
    const isAd = AD_PATTERNS.some((pattern) => pattern.test(trimmed));
    if (isAd) {
      removedCount++;
      continue;
    }

    // 인라인 삽입 광고 괄호 제거 (예: "(Advertisement)", "[Story continues below]")
    let cleanedLine = trimmed
      .replace(/\((?:advertisement|ad|sponsored)\)/gi, '')
      .replace(/\[(?:advertisement|ad|story continues below)\]/gi, '')
      .trim();

    if (!cleanedLine) {
      removedCount++;
      continue;
    }

    filteredLines.push(cleanedLine);
  }

  // 중복 빈 줄 정리
  const cleaned = filteredLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { cleanedText: cleaned, removedCount };
}
