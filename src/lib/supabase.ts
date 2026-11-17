import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'context_vocab_supabase_url';
const STORAGE_ANON_KEY = 'context_vocab_supabase_anon_key';

/**
 * 환경 변수(.env.local / Vercel Env) 또는 브라우저 설정(localStorage)에서
 * Supabase 접속 정보를 안전하게 가져옵니다.
 */
export function getStoredSupabaseConfig(): { url: string; anonKey: string; isCustom: boolean } {
  let url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://mkclocmrpxjrowldfryd.supabase.co';
  let anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_J9jsy23QWH9yXeVE5pMxFg_GbC7MlFE';
  let isCustom = false;

  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem(STORAGE_URL_KEY);
    const customKey = localStorage.getItem(STORAGE_ANON_KEY);
    if (customUrl && customKey) {
      url = customUrl.trim();
      anonKey = customKey.trim();
      isCustom = true;
    }
  }

  // Placeholder key 검사
  const isValid = Boolean(
    url &&
    anonKey &&
    url !== 'https://your-project-id.supabase.co' &&
    anonKey !== 'your-anon-key-here' &&
    url.startsWith('https://')
  );

  return {
    url: isValid ? url : 'https://mkclocmrpxjrowldfryd.supabase.co',
    anonKey: isValid ? anonKey : 'sb_publishable_J9jsy23QWH9yXeVE5pMxFg_GbC7MlFE',
    isCustom,
  };
}

export function setStoredSupabaseConfig(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    if (url && anonKey) {
      localStorage.setItem(STORAGE_URL_KEY, url.trim());
      localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim());
    } else {
      localStorage.removeItem(STORAGE_URL_KEY);
      localStorage.removeItem(STORAGE_ANON_KEY);
    }
    // 인스턴스 재생성을 위해 캐시 무효화
    cachedClient = null;
    lastConfigHash = '';
  }
}

let cachedClient: SupabaseClient | null = null;
let lastConfigHash = '';

/**
 * 활성화된 Supabase 클라이언트 싱글톤을 반환합니다.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getStoredSupabaseConfig();
  if (!url || !anonKey) {
    return null;
  }

  const hash = `${url}_${anonKey}`;
  if (!cachedClient || lastConfigHash !== hash) {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    lastConfigHash = hash;
  }

  return cachedClient;
}

/**
 * 현재 Supabase가 올바르게 설정되어 있는지 여부를 반환합니다.
 */
export function checkIsSupabaseConfigured(): boolean {
  return getSupabaseClient() !== null;
}

// 하위 호환성을 위한 boolean export (클라이언트/서버 최초 렌더용)
export const isSupabaseConfigured = true;

/**
 * 언제 어디서든 getSupabaseClient()의 최신 상태로 라우팅되는 Proxy 객체입니다.
 */
export const supabase: SupabaseClient | null = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    if (!client) return undefined;
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
}) as SupabaseClient;

/**
 * 이메일 / 비밀번호로 로그인
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ data: any; error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { data: null, error: new Error('Supabase 클라이언트가 초기화되지 않았습니다.') };
  }
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  return { data, error: error ? new Error(error.message) : null };
}

/**
 * 이메일 / 비밀번호로 회원가입
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ data: any; error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { data: null, error: new Error('Supabase 클라이언트가 초기화되지 않았습니다.') };
  }
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
  });
  return { data, error: error ? new Error(error.message) : null };
}

/**
 * Google 소셜 로그인 실행
 */
export async function signInWithGoogle(): Promise<{ error: Error | null; url?: string | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      error: new Error(
        'Supabase 프로젝트 연동이 필요합니다. 설정(⚙️) 메뉴에서 Supabase URL과 Anon Key를 입력해 주세요.'
      ),
    };
  }

  const redirectUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}`
      : undefined;

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null, url: data.url };
}

/**
 * 로그아웃 실행
 */
export async function signOutUser(): Promise<{ error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) return { error: null };
  const { error } = await client.auth.signOut();
  return { error: error ? new Error(error.message) : null };
}

/**
 * 현재 로그인된 사용자 정보 조회
 */
export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const {
      data: { user },
    } = await client.auth.getUser();
    return user;
  } catch (err) {
    console.warn('Failed to fetch user:', err);
    return null;
  }
}

/**
 * Supabase SQL Editor에서 원클릭으로 실행할 수 있는 테이블 & RLS 보안 정책 스크립트
 */
export const SUPABASE_SETUP_SQL = `-- ContextVocab 개인별 단어장 & RLS 보안 테이블 설정 SQL
-- Supabase Dashboard > SQL Editor에 복사하여 [RUN] 버튼을 누르세요.

-- 1. vocab_words 테이블 생성
CREATE TABLE IF NOT EXISTS public.vocab_words (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    phonetic TEXT,
    part_of_speech TEXT,
    selected_meaning TEXT NOT NULL,
    all_meanings JSONB DEFAULT '[]'::jsonb,
    context_sentence TEXT,
    candidate_sentences JSONB DEFAULT '[]'::jsonb,
    source_memo TEXT,
    book_title TEXT,
    quiz_count INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    wrong_count INT DEFAULT 0,
    consecutive_correct INT DEFAULT 0,
    last_quiz_date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 기존 테이블이 있는 경우 누락된 컬럼 추가 (안전 실행)
ALTER TABLE public.vocab_words ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.vocab_words ADD COLUMN IF NOT EXISTS wrong_count INT DEFAULT 0;
ALTER TABLE public.vocab_words ADD COLUMN IF NOT EXISTS consecutive_correct INT DEFAULT 0;
ALTER TABLE public.vocab_words ADD COLUMN IF NOT EXISTS last_quiz_date TEXT;
ALTER TABLE public.vocab_words ADD COLUMN IF NOT EXISTS candidate_sentences JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.vocab_words ADD COLUMN IF NOT EXISTS book_title TEXT;

-- 3. Row Level Security (RLS) 활성화: 다른 사용자가 내 단어를 볼 수 없도록 격리
ALTER TABLE public.vocab_words ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (중복 생성 방지)
DROP POLICY IF EXISTS "Users can view their own words" ON public.vocab_words;
DROP POLICY IF EXISTS "Users can insert their own words" ON public.vocab_words;
DROP POLICY IF EXISTS "Users can update their own words" ON public.vocab_words;
DROP POLICY IF EXISTS "Users can delete their own words" ON public.vocab_words;

-- 4. 본인 데이터만 접근 가능한 RLS 정책 등록
CREATE POLICY "Users can view their own words"
    ON public.vocab_words FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own words"
    ON public.vocab_words FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own words"
    ON public.vocab_words FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own words"
    ON public.vocab_words FOR DELETE
    USING (auth.uid() = user_id);

-- 5. 검색 성능 향상을 위한 색인(Index) 추가
CREATE INDEX IF NOT EXISTS idx_vocab_words_user_id ON public.vocab_words(user_id);
`;
