'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/hooks';

/**
 * Client-side route guard: the API and frontend are deployed on separate
 * origins (Vercel + Render), so the session cookie belongs to the API's
 * domain and Next.js middleware on the frontend can't see it. Protection is
 * therefore enforced by calling /auth/me and redirecting on 401 - the real
 * authorization boundary is still server-side (every API route re-checks
 * the session itself), this only keeps a signed-out visitor off the page.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (isError || !data)) {
      router.replace('/login');
    }
  }, [isLoading, isError, data, router]);

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        <span className="text-sm">Checking session…</span>
      </div>
    );
  }
  if (isError || !data) return null;

  return <>{children}</>;
}
