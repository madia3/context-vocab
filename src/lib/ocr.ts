import Tesseract from 'tesseract.js';

// 영어 원서 페이지 이미지에서 텍스트를 고정밀 추출
export async function extractTextFromPageImage(
  imageFile: File | Blob,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    const result = await Tesseract.recognize(imageFile, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });

    const raw = result.data.text || '';
    // 줄바꿈이 문장 중간에 잘린 것 정리
    const cleaned = cleanOcrText(raw);
    return cleaned;
  } catch (error) {
    console.error('OCR Error:', error);
    throw error;
  }
}

// OCR 텍스트 정제 (개행을 공백으로 합치되 문단 구분은 유지, 밑줄/기호 노이즈 제거)
export function cleanOcrText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    // 밑줄/도표 등으로 인해 Tesseract가 만들어내는 기호 쓰레기 제거 (예: "== S 7. 1.", "= SS == b WR", ")Eg. \"0 || r\"")
    .replace(/[=|~_]{2,}[\s\w.|&0-9-]*/g, ' ')
    .replace(/\b(?:SS|XN|NS|WR|oR|Ee|Aa|SSN)\b/g, ' ')
    // 하이픈 사이 노이즈가 낀 단어 복구 (예: "pub - lishing" -> "publishing")
    .replace(/([a-zA-Z]{2,})\s*-\s*([a-z]{3,})/g, '$1$2')
    .replace(/([a-zA-Z]+)-\s*\n\s*([a-zA-Z]+)/g, '$1$2')
    .replace(/([a-zA-Z0-9,;])\n([a-zA-Z0-9])/g, '$1 $2') // 단어 중간 개행 연결
    .replace(/\s+/g, ' ')
    .trim();
}

// 불규칙 동사/명사 및 어형 변화 사전
const COMMON_IRREGULARS: Record<string, string[]> = {
  child: ['children'],
  man: ['men'],
  woman: ['women'],
  person: ['people', 'persons'],
  foot: ['feet'],
  tooth: ['teeth'],
  mouse: ['mice'],
  go: ['goes', 'went', 'gone', 'going'],
  do: ['does', 'did', 'done', 'doing'],
  see: ['sees', 'saw', 'seen', 'seeing'],
  run: ['runs', 'ran', 'running'],
  take: ['takes', 'took', 'taken', 'taking'],
  get: ['gets', 'got', 'gotten', 'getting'],
  make: ['makes', 'made', 'making'],
  know: ['knows', 'knew', 'known', 'knowing'],
  think: ['thinks', 'thought', 'thinking'],
  come: ['comes', 'came', 'coming'],
  give: ['gives', 'gave', 'given', 'giving'],
  find: ['finds', 'found', 'finding'],
  tell: ['tells', 'told', 'telling'],
  feel: ['feels', 'felt', 'feeling'],
  leave: ['leaves', 'left', 'leaving'],
  write: ['writes', 'wrote', 'written', 'writing'],
  read: ['reads', 'reading'],
  speak: ['speaks', 'spoke', 'spoken', 'speaking'],
  bring: ['brings', 'brought', 'bringing'],
  begin: ['begins', 'began', 'begun', 'beginning'],
};

// 단어의 다양한 변화형(복수형, 시제, 분사형, 파생형) 생성
export function generateWordVariants(baseWord: string): string[] {
  const w = baseWord.trim().toLowerCase();
  if (!w) return [];

  const set = new Set<string>();
  set.add(w);

  // 불규칙 매핑 확인
  if (COMMON_IRREGULARS[w]) {
    COMMON_IRREGULARS[w].forEach((v) => set.add(v));
  }
  // 역방향 불규칙 매핑 (예: ran 검색 시 run 추가)
  for (const [root, variants] of Object.entries(COMMON_IRREGULARS)) {
    if (variants.includes(w)) {
      set.add(root);
      variants.forEach((v) => set.add(v));
    }
  }

  // 규칙적 변화형 생성
  // 1) 복수형 / 3인칭 단수: -s, -es, -ies
  if (w.endsWith('y') && !/[aeiou]y$/.test(w)) {
    set.add(w.slice(0, -1) + 'ies'); // party -> parties
    set.add(w.slice(0, -1) + 'ied'); // try -> tried
    set.add(w + 'ing'); // try -> trying
  } else if (w.endsWith('s') || w.endsWith('sh') || w.endsWith('ch') || w.endsWith('x') || w.endsWith('z')) {
    set.add(w + 'es');
  } else {
    set.add(w + 's');
  }

  // 2) 과거형 / 과거분사: -ed, -d
  if (w.endsWith('e')) {
    set.add(w + 'd'); // love -> loved
    set.add(w.slice(0, -1) + 'ing'); // love -> loving
  } else {
    set.add(w + 'ed');
    set.add(w + 'ing');
    // 단모음+단자음 자음 중복 (stop -> stopped, run -> running)
    if (/[aeiou][bcdfghjklmnpqrstvwxyz]$/.test(w) && w.length >= 3) {
      const lastChar = w[w.length - 1];
      set.add(w + lastChar + 'ed');
      set.add(w + lastChar + 'ing');
    }
  }

  // 3) 형용사/부사/명사 파생형
  set.add(w + 'al'); // tradition -> traditional
  set.add(w + 'ly'); // traditional -> traditionally, quick -> quickly
  set.add(w + 'tion');
  set.add(w + 'ness');

  return Array.from(set);
}

// 본문 텍스트를 개별 문장 배열로 정교하게 분리 (약어 Mr., e.g., i.e. 보존 및 따옴표 처리)
export function splitIntoSentences(text: string): string[] {
  if (!text) return [];

  // 1. 단어 중간 하이픈 줄바꿈 복구 (예: tra- dition -> tradition)
  let normalized = text
    .replace(/([a-zA-Z]+)-\s*\n\s*([a-zA-Z]+)/g, '$1$2')
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ');

  // 2. 자주 나오는 영어 약어(Mr., Mrs., Dr., etc., e.g., i.e., vs.)의 온점 임시 치환
  normalized = normalized
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Gen|Rep|Sen|St|etc|e\.g|i\.e|vs)\./gi, '$1{{DOT}}')
    .replace(/(\d+)\.(\d+)/g, '$1{{DOT}}$2'); // 소수점 보호

  // 3. 문장 종결 부호(. ! ?) 뒤 공백, 따옴표, 또는 불릿 기호(-, •, *) 분리
  const rawParts = normalized.split(/(?<=[.!?]["'”’]?)\s+(?:[-•*]\s+)?(?=[A-Z0-9"“'‘])/);

  return rawParts
    .map((s) => s.replace(/\{\{DOT\}\}/g, '.').replace(/^[-•*]\s+/, '').trim())
    .filter((s) => s.length > 5);
}

// 특정 단어가 포함된 모든 원문 문장 목록을 탐색 (동일 단어가 페이지에 여러 번 쓰인 경우)
export function findAllSentencesWithWordSmart(
  fullText: string,
  word: string
): { sentence: string; matchedWord: string }[] {
  if (!fullText || !word) return [];

  const sentences = splitIntoSentences(fullText);
  const variants = generateWordVariants(word);
  const results: { sentence: string; matchedWord: string }[] = [];
  const seenSentences = new Set<string>();

  for (const sentence of sentences) {
    if (seenSentences.has(sentence)) continue;

    // 1. 단어 경계(\b) 기준 정확한 변화형 일치
    let matched: string | null = null;
    for (const variant of variants) {
      const boundaryRegex = new RegExp(`\\b${variant}\\b`, 'i');
      if (boundaryRegex.test(sentence)) {
        matched = variant;
        break;
      }
    }

    // 2. 접두사 확장 형태 (\bword[a-z]*\b) 매칭
    if (!matched) {
      const prefixRegex = new RegExp(`\\b${word.trim().toLowerCase()}[a-z]*\\b`, 'i');
      const m = sentence.match(prefixRegex);
      if (m) matched = m[0];
    }

    // 3. 단순 포함
    if (!matched && sentence.toLowerCase().includes(word.trim().toLowerCase())) {
      matched = word.trim();
    }

    if (matched) {
      seenSentences.add(sentence);
      results.push({ sentence, matchedWord: matched });
    }
  }

  return results;
}

// 특정 단어가 포함된 원문 문장을 형태소 규칙 기반으로 스마트 탐색
export function findSentenceWithWordSmart(
  fullText: string,
  word: string
): { sentence: string; matchedWord: string } | null {
  const all = findAllSentencesWithWordSmart(fullText, word);
  return all.length > 0 ? all[0] : null;
}

// 이전 버전 호환 함수
export function findSentenceWithWord(fullText: string, word: string): string | null {
  const res = findSentenceWithWordSmart(fullText, word);
  return res ? res.sentence : null;
}

// 불규칙 동사/명사/형용사 -> 원형(Lemma) 역방향 매핑 테이블
export const IRREGULAR_TO_BASE: Record<string, string> = {
  // 불규칙 동사 과거형 / 분사 / 3인칭
  went: 'go', gone: 'go', goes: 'go', going: 'go',
  did: 'do', done: 'do', does: 'do', doing: 'do',
  saw: 'see', seen: 'see', sees: 'see', seeing: 'see',
  ran: 'run', runs: 'run', running: 'run',
  took: 'take', taken: 'take', takes: 'take', taking: 'take',
  got: 'get', gotten: 'get', gets: 'get', getting: 'get',
  made: 'make', makes: 'make', making: 'make',
  knew: 'know', known: 'know', knows: 'know', knowing: 'know',
  thought: 'think', thinks: 'think', thinking: 'think',
  came: 'come', comes: 'come', coming: 'come',
  gave: 'give', given: 'give', gives: 'give', giving: 'give',
  found: 'find', finds: 'find', finding: 'find',
  told: 'tell', tells: 'tell', telling: 'tell',
  felt: 'feel', feels: 'feel', feeling: 'feel',
  left: 'leave', leaves: 'leave', leaving: 'leave',
  wrote: 'write', written: 'write', writes: 'write', writing: 'write',
  read: 'read', reads: 'read', reading: 'read',
  spoke: 'speak', spoken: 'speak', speaks: 'speak', speaking: 'speak',
  brought: 'bring', brings: 'bring', bringing: 'bring',
  began: 'begin', begun: 'begin', begins: 'begin', beginning: 'begin',
  bought: 'buy', buys: 'buy', buying: 'buy',
  caught: 'catch', catches: 'catch', catching: 'catch',
  built: 'build', builds: 'build', building: 'build',
  lost: 'lose', loses: 'lose', losing: 'lose',
  sent: 'send', sends: 'send', sending: 'send',
  kept: 'keep', keeps: 'keep', keeping: 'keep',
  fell: 'fall', fallen: 'fall', falls: 'fall', falling: 'fall',
  held: 'hold', holds: 'hold', holding: 'hold',
  drew: 'draw', drawn: 'draw', draws: 'draw', drawing: 'draw',
  flew: 'fly', flown: 'fly', flies: 'fly', flying: 'fly',
  grew: 'grow', grown: 'grow', grows: 'grow', growing: 'grow',
  chose: 'choose', chosen: 'choose', chooses: 'choose', choosing: 'choose',
  drove: 'drive', driven: 'drive', drives: 'drive', driving: 'drive',
  broke: 'break', broken: 'break', breaks: 'break', breaking: 'break',
  wore: 'wear', worn: 'wear', wears: 'wear', wearing: 'wear',
  swam: 'swim', swum: 'swim', swims: 'swim', swimming: 'swim',
  sat: 'sit', sits: 'sit', sitting: 'sit',
  stood: 'stand', stands: 'stand', standing: 'stand',
  slept: 'sleep', sleeps: 'sleep', sleeping: 'sleep',
  understood: 'understand', understands: 'understand',
  meant: 'mean',
  led: 'lead', leads: 'lead', leading: 'lead',
  met: 'meet', meets: 'meet', meeting: 'meet',
  paid: 'pay', pays: 'pay', paying: 'pay',
  laid: 'lay', lays: 'lay', laying: 'lay',
  heard: 'hear', hears: 'hear', hearing: 'hear',
  sold: 'sell', sells: 'sell', selling: 'sell',
  spent: 'spend', spends: 'spend', spending: 'spend',
  won: 'win', wins: 'win', winning: 'win',
  taught: 'teach', teaches: 'teach', teaching: 'teach',
  sang: 'sing', sung: 'sing', sings: 'sing',
  drank: 'drink', drunk: 'drink', drinks: 'drink',
  ate: 'eat', eaten: 'eat', eats: 'eat',
  cut: 'cut', cuts: 'cut',
  put: 'put', puts: 'put',
  hit: 'hit', hits: 'hit',
  set: 'set', sets: 'set',

  // 불규칙 명사 복수형
  children: 'child',
  men: 'man',
  women: 'woman',
  people: 'person',
  persons: 'person',
  feet: 'foot',
  teeth: 'tooth',
  mice: 'mouse',
  geese: 'goose',
  oxen: 'ox',
  data: 'datum',
  criteria: 'criterion',
  phenomena: 'phenomenon',
  analyses: 'analysis',
  crises: 'crisis',
  hypotheses: 'hypothesis',
  theses: 'thesis',
  bases: 'basis',

  // 비교급 / 최상급
  better: 'good',
  best: 'good',
  worse: 'bad',
  worst: 'bad',
  more: 'many',
  most: 'many',
  less: 'little',
  least: 'little',
  farther: 'far',
  further: 'far',
  farthest: 'far',
  furthest: 'far',
};

// 원래 s로 끝나는 단어(단수 명사/부사/전치사/학문) 보호 목록
const WORDS_NATURALLY_ENDING_IN_S = new Set([
  'always', 'sometimes', 'perhaps', 'towards', 'besides', 'nowadays', 'whereas', 'downstairs', 'upstairs', 'outdoors', 'indoors', 'overseas', 'nonetheless', 'nevertheless',
  'series', 'species', 'news', 'means', 'goods', 'clothes', 'economics', 'politics', 'physics', 'mathematics', 'statistics', 'ethics', 'genetics', 'linguistics', 'logistics', 'athletics', 'mechanics', 'electronics', 'optics', 'robotics', 'aerobics', 'acoustics', 'tactics',
  'focus', 'status', 'consensus', 'census', 'campus', 'virus', 'bonus', 'genius', 'corpus', 'surplus', 'apparatus', 'stimulus', 'syllabus',
  'lens', 'chaos', 'bias', 'canvas', 'atlas', 'alias', 'gas', 'bus', 'plus', 'thus', 'this',
  'basis', 'crisis', 'analysis', 'thesis', 'hypothesis', 'diagnosis', 'emphasis', 'oasis', 'synthesis', 'debris', 'chassis', 'cosmos', 'ethos', 'pathos',
]);

// 원래 ing로 끝나는 단수 명사/전치사/고유 단어 보호 목록
const WORDS_NATURALLY_ENDING_IN_ING = new Set([
  'thing', 'something', 'anything', 'nothing', 'everything',
  'spring', 'string', 'bring', 'during', 'ceiling', 'morning', 'evening', 'sibling', 'lightning', 'darling',
  'king', 'ring', 'sing', 'wing', 'cling', 'fling', 'sting', 'swing',
  'meaning', 'building', 'feeling', 'training', 'learning', 'meeting', 'drawing', 'painting', 'hearing', 'warning', 'clothing', 'living', 'shipping', 'gathering', 'offering', 'setting', 'outing', 'willing',
]);

// 원래 ed로 끝나는 기본 단어(단수 명사/형용사/동사 원형) 보호 목록
const WORDS_NATURALLY_ENDING_IN_ED = new Set([
  'speed', 'succeed', 'proceed', 'exceed', 'indeed', 'greed', 'bleed', 'breed', 'steed', 'creed',
  'naked', 'sacred', 'hatred', 'hundred', 'kindred', 'wicked', 'wretched', 'crooked', 'ragged', 'rugged', 'beloved',
]);

// 원래 ier로 끝나는 명사 보호 목록 (비교급 오변환 방지: barrier -> barry 등 방지)
const WORDS_NATURALLY_ENDING_IN_IER = new Set([
  'barrier', 'soldier', 'glacier', 'frontier', 'courier', 'cashier', 'premier', 'tier', 'pier',
]);

// 원래 est로 끝나는 명사/형용사 보호 목록 (최상급 오변환 방지: priest -> pry 등 방지)
const WORDS_NATURALLY_ENDING_IN_EST = new Set([
  'priest', 'chest', 'guest', 'nest', 'rest', 'test', 'west', 'best', 'forest', 'interest', 'honest', 'modest', 'request', 'suggest', 'protest', 'invest', 'arrest', 'contest', 'harvest',
]);

// 불규칙 -ves -> -f / -fe 명확한 폐쇄 집합
const VES_IRREGULAR_MAP: Record<string, string> = {
  knives: 'knife',
  wives: 'wife',
  lives: 'life',
  leaves: 'leaf',
  halves: 'half',
  calves: 'calf',
  wolves: 'wolf',
  shelves: 'shelf',
  selves: 'self',
  themselves: 'themselves',
  ourselves: 'ourselves',
  yourselves: 'yourself',
  thieves: 'thief',
  loaves: 'loaf',
  sheaves: 'sheaf',
  scarves: 'scarf',
  wharves: 'wharf',
  elves: 'elf',
};

// -ie로 끝나는 명사의 복수형 (-ies -> -ie 복원: movies -> movie, cookies -> cookie 등)
const IE_NOUNS_MAP: Record<string, string> = {
  movies: 'movie',
  cookies: 'cookie',
  calories: 'calorie',
  brownies: 'brownie',
  zombies: 'zombie',
  prairies: 'prairie',
  rookies: 'rookie',
  hippies: 'hippie',
};

// 복수형, 과거형, 진행형, 3인칭 단수 등을 단어장 등록용 '원형(Lemma)'으로 복원
export function extractLemmaCandidate(rawWord: string): string {
  const w = rawWord.trim().toLowerCase();
  if (w.length <= 2) return w;

  // 1. 고유 형태 보존 (본래 s, ing, ed, ier, est 등으로 끝나는 고유 기본 어휘)
  if (WORDS_NATURALLY_ENDING_IN_S.has(w)) return w;
  if (WORDS_NATURALLY_ENDING_IN_ING.has(w)) return w;
  if (WORDS_NATURALLY_ENDING_IN_ED.has(w)) return w;
  if (WORDS_NATURALLY_ENDING_IN_IER.has(w)) return w;
  if (WORDS_NATURALLY_ENDING_IN_EST.has(w)) return w;

  // 2. 불규칙 사전 매핑 확인
  if (IRREGULAR_TO_BASE[w]) return IRREGULAR_TO_BASE[w];
  if (VES_IRREGULAR_MAP[w]) return VES_IRREGULAR_MAP[w];
  if (IE_NOUNS_MAP[w]) return IE_NOUNS_MAP[w];

  // 3. 복수형 / 3인칭 단수 -ies -> -y (cities -> city, parties -> party, stories -> story)
  if (w.endsWith('ies') && w.length > 4) {
    return w.slice(0, -3) + 'y';
  }

  // 4. 과거형 / 분사 -ied -> -y (studied -> study, carried -> carry, worried -> worry)
  if (w.endsWith('ied') && w.length > 4) {
    return w.slice(0, -3) + 'y';
  }

  // 5. -sses 복수형 (classes -> class, passes -> pass, processes -> process, addresses -> address)
  // 반드시 -ses 전에 처리해야 classes -> classe 오변환 차단!
  if (w.endsWith('sses') && w.length > 5) {
    return w.slice(0, -2);
  }

  // 6. -shes, -ches, -xes 복수형/3인칭단수 (wishes -> wish, watches -> watch, boxes -> box, taxes -> tax)
  if (
    (w.endsWith('shes') && w.length > 5) ||
    (w.endsWith('ches') && w.length > 5) ||
    (w.endsWith('xes') && w.length > 4)
  ) {
    return w.slice(0, -2);
  }

  // 7. -zzes (quizzes -> quiz, buzzes -> buzz)
  if (w.endsWith('zzes') && w.length > 5) {
    if (w === 'quizzes') return 'quiz';
    return w.slice(0, -2);
  }

  // 8. -zes (sizes -> size, prizes -> prize, freezes -> freeze, realizes -> realize, analyzes -> analyze)
  if (w.endsWith('zes') && w.length > 4) {
    return w.slice(0, -1);
  }

  // 9. -e로 끝나는 단어에 s가 붙은 복수형/3인칭단수 (-s만 제거: perspective, price, change, cause 등)
  if (
    w.endsWith('ces') || // prices -> price, devices -> device
    w.endsWith('ges') || // changes -> change, pages -> page
    w.endsWith('ses') || // causes -> cause, houses -> house, phrases -> phrase, promises -> promise
    w.endsWith('tes') || // plates -> plate, states -> state
    w.endsWith('des') || // slides -> slide, guides -> guide
    w.endsWith('nes') || // lines -> line, tones -> tone
    w.endsWith('les') || // rules -> rule, files -> file
    w.endsWith('ves') || // perspectives -> perspective, objectives -> objective
    w.endsWith('res') || // stores -> store, figures -> figure
    w.endsWith('mes') || // homes -> home, names -> name
    w.endsWith('pes') || // types -> type, shapes -> shape
    w.endsWith('kes') || // strikes -> strike, stakes -> stake
    w.endsWith('bes')    // tubes -> tube, probes -> probe
  ) {
    return w.slice(0, -1);
  }

  // 10. 불규칙 -oes (heroes -> hero, potatoes -> potato, tomatoes -> tomato)
  if (['heroes', 'potatoes', 'tomatoes', 'echoes', 'tornadoes', 'volcanoes'].includes(w)) {
    return w.slice(0, -2);
  }

  // 11. 진행형 / 동명사 -ing (growing -> grow, running -> run, declining -> decline, publishing -> publish)
  if (w.endsWith('ing') && w.length > 4) {
    const stem = w.slice(0, -3);
    // 자음 중복 (running -> run, stopping -> stop, swimming -> swim, getting -> get, winning -> win)
    if (
      stem.length >= 3 &&
      stem[stem.length - 1] === stem[stem.length - 2] &&
      /[bcdfghjklmnpqrstvwxyz]/.test(stem[stem.length - 1]) &&
      !['ll', 'ss', 'ff', 'zz'].includes(stem.slice(-2))
    ) {
      return stem.slice(0, -1);
    }
    if (w === 'tying') return 'tie';
    if (w === 'dying') return 'die';
    if (w === 'lying') return 'lie';

    // v, c, g, z로 끝나거나 대표적 VCe(단모음+단자음+e) 어간인 경우에만 e 복원
    if (
      /[vcz]$/.test(stem) ||
      /(?:mak|tak|writ|driv|rid|ris|smil|lik|lov|hat|hop|us|abus|choos|los|clos|caus|paus|increas|decreas|releas|declin|defin|combin|imagin|determin|examin|sharin|car|stori|prepar|compar|declar|requir|acquir|inspir|retir|desir|provid|decid|divid|includ|conclud|excl|produc|reduc|introduc|indu|creat|relat|operat|indicat|estimat|participat|investigat|generat|separat|celebrat|communicat|illustrat|demonstrat|translat|negoti|appreci|associ|eval|continu|argu|val|issu|rescu|pursu|chang|manag|encourag|damag|averag|challeng|arrang|judg|acknowledg|emerg|merg|charg|larg|forc|sourc|notic|practic|servic|advic|balanc|danc|instanc|distanc|influenc|experienc|announc|pronounc|convinc|produc)$/.test(stem)
    ) {
      return stem + 'e';
    }
    return stem;
  }

  // 12. 과거형 / 분사 -ed (declined -> decline, boosted -> boost, stopped -> stop, looked -> look)
  if (w.endsWith('ed') && w.length > 4) {
    const stem = w.slice(0, -2);
    // 자음 중복 (stopped -> stop, planned -> plan, begged -> beg)
    if (
      stem.length >= 3 &&
      stem[stem.length - 1] === stem[stem.length - 2] &&
      /[bcdfghjklmnpqrstvwxyz]/.test(stem[stem.length - 1]) &&
      !['ll', 'ss', 'ff', 'zz'].includes(stem.slice(-2))
    ) {
      return stem.slice(0, -1);
    }
    if (w.endsWith('eed')) {
      if (['agreed', 'freed', 'guaranteed', 'decreed'].includes(w)) {
        return w.slice(0, -1);
      }
      return w;
    }
    if (stem.endsWith('e')) {
      return stem;
    }
    // v, c, g, z로 끝나거나 대표적 VCe 어간인 경우에만 e 복원
    if (
      /[vcz]$/.test(stem) ||
      /(?:lik|lov|hat|hop|us|abus|clos|caus|paus|increas|decreas|releas|declin|defin|combin|imagin|determin|examin|shar|car|prepar|compar|declar|requir|acquir|inspir|retir|desir|provid|decid|divid|includ|conclud|produc|reduc|introduc|creat|relat|operat|indicat|estimat|participat|investigat|generat|separat|celebrat|communicat|illustrat|demonstrat|translat|negoti|appreci|associ|evaluat|continu|argu|valu|issu|rescu|pursu|chang|manag|encourag|damag|averag|challeng|arrang|judg|acknowledg|emerg|merg|charg|forc|sourc|notic|practic|servic|balanc|danc|influenc|experienc|announc|pronounc|convinc|motiv|achiev|believ|receiv|perceiv|observ|preserv|reserv|deserv|serv|solv|involv|evolv|resolv|improv|approv|remov|mov|prov|liv|surv|arriv|deriv)$/.test(stem)
    ) {
      return stem + 'e';
    }
    return stem;
  }

  // 13. 단순 복수형 / 3인칭 단수 -s (prices -> price, books -> book, cats -> cat, forecasts -> forecast)
  if (
    w.endsWith('s') &&
    !w.endsWith('ss') &&
    !w.endsWith('us') &&
    !w.endsWith('is') &&
    !w.endsWith('os') &&
    w.length > 3
  ) {
    const stripped = w.slice(0, -1);
    if (WORDS_NATURALLY_ENDING_IN_ING.has(stripped)) return stripped;
    return stripped;
  }

  // 14. 비교급 -ier -> -y, -iest -> -y (easier -> easy, happiest -> happy)
  if (w.endsWith('ier') && w.length > 4) {
    return w.slice(0, -3) + 'y';
  }
  if (w.endsWith('iest') && w.length > 5) {
    return w.slice(0, -4) + 'y';
  }

  return w;
}
