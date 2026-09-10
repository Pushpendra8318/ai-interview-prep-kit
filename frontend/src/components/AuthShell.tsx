const FEATURES = [
  { icon: '🔎', text: 'Real research — crawls the company site and public discussion' },
  { icon: '🧩', text: 'A deterministic coverage check closes every gap in your prep' },
  { icon: '🗓️', text: 'A day-by-day schedule that adapts to how long you have' },
];

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="flex min-h-screen">
      <section className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-brand-gradient p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)',
            backgroundSize: '48px 48px, 64px 64px',
          }}
        />
        <div className="relative z-10 flex items-center gap-2 font-display text-lg font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-base backdrop-blur-sm">
            ✦
          </span>
          PrepKit
        </div>
        <div className="relative z-10 max-w-sm">
          <h2 className="font-display text-3xl font-semibold leading-tight">
            Turn any job posting into a real prep plan.
          </h2>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-start gap-3 text-sm text-white/90">
                <span className="text-lg leading-none">{f.icon}</span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-white/60"></p>
      </section>

      <section className="flex w-full flex-1 items-center justify-center px-4 py-12 lg:w-[58%]">
        <div className="w-full max-w-sm">
          <p className="mb-1 text-sm font-medium uppercase tracking-wide text-brand-600">{eyebrow}</p>
          <h1 className="mb-2 font-display text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mb-8 text-sm text-slate-500">{subtitle}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
