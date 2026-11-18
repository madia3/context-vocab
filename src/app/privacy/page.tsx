import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보처리방침 | divivid voca',
  description: 'divivid voca 개인정보처리방침 안내',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-200 space-y-8">
        {/* Header */}
        <div className="border-b border-slate-100 pb-5">
          <div className="flex items-center justify-between mb-3">
            <Link
              href="/"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
            >
              ← 메인으로 돌아가기
            </Link>
            <span className="text-xs text-slate-400 font-medium">최종 개정일: 2026년 11월 17일</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            개인정보처리방침 (Privacy Policy)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            divivid (이하 &apos;서비스&apos;, 웹 주소: voca.divivid.com 및 divivid.com)는 이용자의 개인정보를 매우 중요하게 생각하며, 관련 법령을 준수합니다.
          </p>
        </div>

        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">1. 수집하는 개인정보의 항목 및 수집 방법</h2>
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed space-y-2">
            <p>
              서비스는 원활한 영한 단어장 동기화 및 퀴즈 학습 기능 제공을 위해 Google OAuth(소셜 로그인) 인증 시 다음과 같은 최소한의 정보를 수집합니다:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li><strong>Google 계정 정보:</strong> 이메일 주소, 이름/닉네임, 프로필 이미지 URL (고유 사용자 식별용)</li>
              <li><strong>학습 및 단어 데이터:</strong> 사용자가 직접 등록한 단어, 문맥 문장, 출처 메모, 단어장 분류, 퀴즈 풀이 이력(정답/오답 통계)</li>
            </ul>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">2. 개인정보의 수집 및 이용 목적</h2>
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed space-y-1">
            <p>수집된 개인정보는 오직 다음의 목적으로만 활용됩니다:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li>사용자 식별 및 개인별 단어 데이터 격리(RLS 보안 적용)</li>
              <li>기기 간 단어장 실시간 클라우드 동기화 및 백업</li>
              <li>스마트 맞춤 복습 알고리즘(오답 및 망각 주기 기반 퀴즈 출제) 제공</li>
            </ul>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">3. 개인정보의 보유 및 이용 기간</h2>
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            <p>
              이용자의 개인정보는 서비스 이용 기간 동안 안전하게 보관되며, 사용자가 회원 탈퇴 또는 데이터 삭제를 요청할 경우 지체 없이 영구 파기됩니다.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">4. 개인정보의 제3자 제공 및 공유 금지</h2>
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            <p>
              서비스는 어떠한 경우에도 이용자의 개인정보 및 단어 학습 데이터를 외부에 판매, 임대, 또는 상업적 목적으로 제3자에게 제공하지 않습니다.
            </p>
          </div>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">5. Google 사용자 데이터 정책 준수</h2>
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            <p>
              서비스의 Google API 활용 및 전송 정보는 제한적 사용 요건을 포함하여 <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold">Google API 서비스 사용자 데이터 정책</a>을 철저히 준수합니다.
            </p>
          </div>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">6. 개인정보 보호책임자 및 문의처</h2>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs sm:text-sm text-slate-700 space-y-1">
            <p><strong>서비스명:</strong> divivid voca</p>
            <p><strong>대표 도메인:</strong> divivid.com / voca.divivid.com</p>
            <p><strong>문의 이메일:</strong> <a href="mailto:ashstone3@gmail.com" className="text-indigo-600 underline font-bold">ashstone3@gmail.com</a></p>
            <p className="text-slate-500 text-xs mt-1">개인정보 열람, 정정, 삭제 요청은 위 문의처로 연락해 주시면 즉각 처리해 드립니다.</p>
          </div>
        </section>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <Link
            href="/terms"
            className="text-xs text-indigo-600 hover:underline font-bold"
          >
            서비스 이용약관 보기 ➔
          </Link>
          <Link
            href="/"
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2 rounded-xl transition"
          >
            홈으로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
