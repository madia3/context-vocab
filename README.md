# ContextVocab (원서 영한 단어장 & 5지선다 퀴즈) 📖🎯

영어 원서나 레포트를 읽다가 모르는 단어를 발견했을 때, 문맥(원문 문장)과 함께 저장하고 5지선다 객관식 퀴즈로 복습할 수 있는 웹 애플리케이션입니다.

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

5. **완전 무료 & 서버 불필요 (0원 유지)**:
   - 외부 유료 서버나 데이터베이스 없이 브라우저의 `localStorage`에 안전하게 저장됩니다.
   - 브라우저 내장 음성 합성(SpeechSynthesis)으로 비용 없이 무제한 발음 청취가 가능합니다.

---

## 💻 맥북(Mac)에서 실행하는 방법

### 방법 1: Git Clone 후 바로 열기 (추천)
맥북의 **터미널(Terminal)** 앱을 열고 아래 명령어를 순서대로 입력하세요:

```bash
# 1. 레포지토리 복제
git clone https://github.com/madia3/context-vocab.git

# 2. 폴더 이동
cd context-vocab

# 3. 브라우저로 열기 (Chrome 또는 Safari)
open index.html
```

### 방법 2: Finder에서 더블클릭
1. 복제된 `context-vocab` 폴더로 이동합니다.
2. `index.html` 파일을 더블클릭하면 즉시 실행됩니다!

---

## 🛠️ 기술 스택
- **Frontend**: HTML5, Vanilla JavaScript, Tailwind CSS
- **TTS Engine**: Web Speech API (Browser Native)
- **Dictionary**: Google Translate Dictionary Engine & Open API
- **Storage**: Browser LocalStorage
