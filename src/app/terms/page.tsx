import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '서비스 이용약관 | 원서. 문장. 단어 (divivid)',
  description: '원서. 문장. 단어 (divivid) 서비스 이용약관 안내',
};

export default function TermsOfServicePage() {
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
            <span className="text-xs text-slate-400 font-medium">최종 개정일: 2026년 11월 19일</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            서비스 이용약관 (Terms of Service)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            본 약관은 원서. 문장. 단어 (이하 &apos;서비스&apos;, 주소: voca.divivid.com 및 divivid.com)가 제공하는 문맥 영한 단어장 및 퀴즈 서비스의 이용 조건 및 절차에 관한 사항을 규정합니다.
          </p>
        </div>

        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">제1조 (목적)</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            본 약관은 이용자가 서비스가 제공하는 온라인 단어 암기, 원문 문맥 등록, OCR 및 AI 지원 학습 기능을 이용함에 있어 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">제2조 (서비스의 제공 및 변경)</h2>
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed space-y-2">
            <p>서비스는 다음과 같은 기능을 이용자에게 무상 또는 유상으로 제공합니다:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li>문맥 기반 영한 단어장 생성, 관리 및 기기 간 동기화</li>
              <li>망각 곡선 및 오답 우선순위 기반 스마트 5지선다 복습 퀴즈</li>
              <li>원어민 자연스러운 고음질 음성 낭독 (TTS) 지원</li>
            </ul>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">제3조 (이용자의 의무)</h2>
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed space-y-1">
            <p>이용자는 다음 각 호의 행위를 하여서는 안 됩니다:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li>타인의 정보 도용 또는 허위 사실 등록</li>
              <li>서비스의 운영을 고의로 방해하거나 서버에 비정상적인 부하를 주는 행위</li>
              <li>관련 법령 및 공서양속에 위배되는 불법 콘텐츠 게시</li>
            </ul>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">제4조 (지식재산권, 저작권 및 데이터의 책임)</h2>
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed space-y-2">
            <p>
              이용자가 서비스에 등록·입력·촬영(OCR)·발췌하여 저장하는 단어, 원문 문장, 출처 메모 등의 학습 데이터에 대한 모든 권리와 법적 책임은 이용자 본인에게 있습니다.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li>
                <strong>저작권 준수 및 사적 학습 목적 이용:</strong> 도서(원서), 기사, 웹문서 등 제3자의 저작물에서 문장을 발췌·저장할 때 관련 저작권법을 준수하고 개인의 사적 학습·복습 범위 내에서 이용해야 할 책임은 전적으로 이용자 본인에게 있습니다.
              </li>
              <li>
                <strong>비공개 보관 및 무단 배포 금지:</strong> 이용자가 저장한 단어와 문장은 본인 계정 전용 비공개 공간(RLS 격리 적용)에만 보관되며, 타인에게 공개되지 않습니다. 이용자는 저작권이 있는 원문 데이터를 제3자에게 무단 공유·배포하거나 상업적 목적으로 이용해서는 안 됩니다.
              </li>
              <li>
                <strong>운영자 면책:</strong> 서비스 운영자는 이용자가 개인 학습 공간에 임의로 등록·저장한 단어, 문장, 이미지 등의 콘텐츠에 대해 사전 검열 의무를 지지 않으며, 이로 인해 발생하는 저작권 침해 등 제3자와의 일체의 분쟁 및 법적 책임은 해당 이용자에게 귀속됩니다.
              </li>
            </ul>
          </div>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">제5조 (책임의 한계)</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            서비스는 천재지변, 클라우드 인프라 장애 등 불가항력으로 인해 일시적으로 서비스를 제공할 수 없는 경우 책임이 면제되며, 서비스 이용과 관련하여 무료로 제공되는 기능에 대해서는 관련 법에 특별한 규정이 없는 한 손해배상 책임을 지지 않습니다.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">제6조 (문의 및 연락처)</h2>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs sm:text-sm text-slate-700 space-y-1">
            <p><strong>운영자:</strong> divivid</p>
            <p><strong>문의 이메일:</strong> <a href="mailto:ashstone3@gmail.com" className="text-indigo-600 underline font-bold">ashstone3@gmail.com</a></p>
            <p><strong>웹사이트:</strong> voca.divivid.com</p>
          </div>
        </section>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <Link
            href="/privacy"
            className="text-xs text-indigo-600 hover:underline font-bold"
          >
            개인정보처리방침 보기 ➔
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
