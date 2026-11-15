-- Supabase PostgreSQL Table Schema for ContextVocab
-- Supabase 대시보드 -> SQL Editor 에서 복사하여 실행하세요.

-- 1. vocab_words 테이블 생성
create table if not exists public.vocab_words (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  word text not null,
  phonetic text,
  part_of_speech text,
  selected_meaning text not null,
  all_meanings jsonb default '[]'::jsonb,
  context_sentence text,
  source_memo text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. 인덱스 생성
create index if not exists vocab_words_user_id_idx on public.vocab_words(user_id);
create index if not exists vocab_words_word_idx on public.vocab_words(word);

-- 3. Row Level Security (RLS) 활성화
alter table public.vocab_words enable row level security;

-- 4. RLS 정책 생성 (비로그인 익명 또는 사용자별 접근)
-- 비로그인 사용자 및 테스트용(누구나 읽기/쓰기 허용하거나 인증 사용자별로 분리 가능)
-- (옵션 A) 인증된 사용자만 본인 단어 접근
create policy "Users can select own vocab words"
  on public.vocab_words for select
  using (auth.uid() = user_id or user_id is null);

create policy "Users can insert vocab words"
  on public.vocab_words for insert
  with check (auth.uid() = user_id or user_id is null);

create policy "Users can update own vocab words"
  on public.vocab_words for update
  using (auth.uid() = user_id or user_id is null);

create policy "Users can delete own vocab words"
  on public.vocab_words for delete
  using (auth.uid() = user_id or user_id is null);
