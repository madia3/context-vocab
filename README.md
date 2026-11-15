# ContextVocab (원서 영한 단어장 & 5지선다 퀴즈) 📖🎯

영어 원서나 레포트를 읽다가 모르는 단어를 발견했을 때, 문맥(원문 문장)과 함께 저장하고 5지선다 객관식 퀴즈로 복습할 수 있는 웹 애플리케이션입니다.

**Next.js 14 + Tailwind CSS + Supabase + Vercel** 풀스택 환경으로 구축되었습니다.

---

## ✨ 주요 기능

1. **실시간 영한 사전 조회**:
   - 단어를 검색하면 품사(명사, 동사, 형용사 등)별 다양한 한국어 뜻 목록이 표시됩니다.
   - 원서 문맥에 가장 잘 어울리는 뜻을 선택하여 저장할 수 있습니다.
   - 사전에 없는 특별한 뜻이나 의역은 직접 입력할 수도 있습니다.

2. **원문 문맥(Context) 저장**:
   - 원서나 레포트에서 발췌한 원문 문장을 함께 기록합니다.

3. **5지선다 객관식 퀴즈**:
   - 단어가 문제로 주어지면 5개의 한국어 뜻 선지 중 정답을 맞히는 퀴즈 모드입니다.
   - 단어가 적어도 내장된 오답 풀을 통해 항상 풍성한 5지선다 보기가 구성됩니다.

4. **원문 하이라이트 & 원어민 음성(TTS) 읽기**:
   - 퀴즈 정답 시 단어 발음이 자동으로 재생됩니다.
   - 내가 입력했던 **원문 문장 속 해당 단어가 형광펜으로 강조**되어 표시됩니다.
   - 브라우저 내장 Web Speech API를 통해 **원문 문장 전체를 원어민 발음으로 읽어줍니다.**

5. **Supabase 클라우드 DB & 온디바이스 Fallback**:
   - Supabase를 연동하면 기기 간 실시간 동기화가 이루어집니다.
   - Supabase 설정이 없더라도 브라우저 `localStorage`로 즉시 동작합니다.

---

## 🛠️ 기술 스택
- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **TTS Engine**: Web Speech API (Browser Native)
- **Dictionary**: Google Translate Dictionary Engine & Open API

---

## 🚀 빠른 시작 가이드 (Local Run)

```bash
# 1. 패키지 설치
npm install

# 2. 로컬 개발 서버 실행
npm run dev
# 브라우저에서 http://localhost:3000 접속
```

---

## 🗄️ Supabase 설정 방법

1. [Supabase](https://supabase.com/)에서 새 프로젝트를 생성합니다.
2. 좌측 메뉴 **SQL Editor**로 이동하여 [`supabase/schema.sql`](./supabase/schema.sql) 파일의 내용을 복사해 붙여넣고 실행(Run)합니다.
3. 좌측 하단 **Project Settings** -> **API**에서 `Project URL`과 `anon public key`를 복사합니다.
4. 프로젝트 루트의 `.env.local` 파일에 다음과 같이 추가합니다:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

---

## ☁️ Vercel 배포 방법

1. 비공개(Private) GitHub 레포지토리에 코드를 푸시합니다.
2. [Vercel](https://vercel.com/) 대시보드에서 **Add New Project** 클릭 후 GitHub 레포지토리를 불러옵니다.
3. **Environment Variables**에 위 Supabase 환경 변수 2개를 입력하고 **Deploy**를 누르면 끝납니다.
