'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const client = getSupabaseClient();
    if (client) {
      // Supabase JS client automatically extracts the session from hash or code
      client.auth.getSession().then(() => {
        router.replace('/');
      }).catch(() => {
        router.replace('/');
      });
    } else {
      router.replace('/');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 text-center space-y-3 max-w-sm w-full">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <h3 className="font-bold text-slate-900 text-sm">Google 로그인 처리 중...</h3>
        <p className="text-xs text-slate-500">잠시만 기다려 주세요. 메인 화면으로 이동합니다.</p>
      </div>
    </div>
  );
}
