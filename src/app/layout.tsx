import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ContextVocab - 원서 영한 단어장 & 5지선다 퀴즈',
  description: '영어 원서와 리포트 속 문맥과 함께 저장하고 5지선다 객관식 퀴즈로 복습하는 단어장 앱 (Next.js + Supabase)',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-slate-100 text-slate-800 font-sans min-h-screen flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
