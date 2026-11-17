import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ContextVocab | 이과장 영한단어장 & 5지선다 퀴즈',
  description: '영어 원서·기사 문맥과 함께 저장하고 5지선다 객관식 퀴즈로 완벽 복습하는 영한 단어장 (이과장.com)',
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
      <body className="bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col antialiased selection:bg-brand-100 selection:text-brand-900">
        {children}
      </body>
    </html>
  );
}
