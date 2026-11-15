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
  book_title text default '기본 단어장',
  quiz_count integer default 0,
  correct_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 기존 테이블이 있다면 신규 컬럼 추가용 쿼리
alter table public.vocab_words add column if not exists book_title text default '기본 단어장';
alter table public.vocab_words add column if not exists quiz_count integer default 0;
alter table public.vocab_words add column if not exists correct_count integer default 0;

-- 2. 인덱스 생성
create index if not exists vocab_words_user_id_idx on public.vocab_words(user_id);
create index if not exists vocab_words_word_idx on public.vocab_words(word);
create index if not exists vocab_words_book_title_idx on public.vocab_words(book_title);

-- 3. Row Level Security (RLS) 활성화
alter table public.vocab_words enable row level security;

-- 4. RLS 정책 생성 (비로그인 익명 또는 사용자별 접근)
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
