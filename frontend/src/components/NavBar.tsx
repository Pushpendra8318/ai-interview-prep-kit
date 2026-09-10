'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useMe } from '@/lib/hooks';

export function NavBar() {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me } = useMe();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  async function logout() {
    await api.post('/api/v1/auth/logout');
    qc.clear();
    router.replace('/login');
  }

  const initials = (me?.name || me?.email || '?').trim().slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-display text-[15px] font-semibold text-slate-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-sm text-white shadow-glow">
            ✦
          </span>
          <span>
            Prep<span className="brand-text">Kit</span>
          </span>
        </Link>

        <button
          className="btn-ghost md:hidden"
          aria-expanded={open}
          aria-controls="nav-links"
          onClick={() => setOpen((o) => !o)}
        >
          Menu
        </button>

        <nav id="nav-links" className={`${open ? 'flex' : 'hidden'} md:flex items-center gap-1`}>
          <Link href="/dashboard" className="btn-ghost">
            Dashboard
          </Link>
          <Link href="/kits/new" className="btn-ghost">
            New Kit
          </Link>

          <div className="relative ml-1" ref={menuRef}>
            <button
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2.5 transition-colors hover:bg-slate-100"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient-soft font-display text-sm font-semibold text-brand-700">
                {initials}
              </span>
              <span className="hidden max-w-[9rem] truncate text-sm font-medium text-slate-700 sm:inline">
                {me?.name || me?.email}
              </span>
              <span aria-hidden className="text-xs text-slate-400">
                ▾
              </span>
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="section-fade absolute right-0 top-[calc(100%+8px)] w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-soft"
              >
                <div className="border-b border-slate-100 px-3.5 py-2.5">
                  <p className="truncate text-sm font-medium text-slate-900">{me?.name}</p>
                  <p className="truncate text-xs text-slate-500">{me?.email}</p>
                </div>
                <button
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                  onClick={logout}
                >
                  <span aria-hidden>↩</span> Log out
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
