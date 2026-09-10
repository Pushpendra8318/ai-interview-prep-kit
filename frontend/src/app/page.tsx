'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/hooks';

export default function HomePage() {
  const { data, isLoading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.replace(data ? '/dashboard' : '/login');
  }, [data, isLoading, router]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-brand-gradient-soft">
      <span className="flex h-12 w-12 animate-pulse items-center justify-center rounded-xl bg-brand-gradient text-xl text-white shadow-glow">
        ✦
      </span>
      <p className="text-sm text-slate-500">Loading PrepKit…</p>
    </div>
  );
}
