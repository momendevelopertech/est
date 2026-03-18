const foundationCards = [
  {
    title: "Canonical data model",
    eyebrow: "Prisma",
    description:
      "The schema is locked and covers locations, proctors, app users, cycles, assignments, waiting list, attendance, evaluations, blocks, settings, and auditability."
  },
  {
    title: "Real application baseline",
    eyebrow: "Next.js App Router",
    description:
      "The repository now has a production-oriented app tree, typed configuration, and the first runtime primitives instead of planning docs only."
  },
  {
    title: "Runtime discipline",
    eyebrow: "Environment + database",
    description:
      "Prisma client bootstrapping and environment validation are wired so later slices can add services and routes without reworking the foundation."
  }
] as const;

const nextTrack = [
  "Add the shared app shell, route groups, and navigation structure.",
  "Introduce authentication shell and protected layouts for app users.",
  "Add bilingual locale files, RTL or LTR handling, and top-bar language controls.",
  "Layer in dark, light, and system theme controls on top of the semantic token base."
] as const;

const productPillars = [
  {
    title: "Bilingual from day one",
    description:
      "Arabic and English are first-class requirements, so even the bootstrap page carries both voices."
  },
  {
    title: "Responsive operations",
    description:
      "The layout is mobile-aware now and leaves room for denser tablet and desktop workflows in later slices."
  },
  {
    title: "Dynamic-by-default",
    description:
      "Operational rules, labels, thresholds, and notification behavior are still expected to live in settings or data instead of code constants."
  }
] as const;

export default function Home() {
  return (
    <main className="min-h-screen bg-hero-glow">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <section className="panel overflow-hidden rounded-panel px-6 py-6 sm:px-8 sm:py-8">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-3 text-[11px] font-medium uppercase tracking-[0.28em] text-text-secondary">
                <span className="rounded-full bg-surface-elevated px-3 py-1 text-accent">
                  Slice 0
                </span>
                <span className="rounded-full bg-surface-elevated px-3 py-1">
                  Foundation bootstrap
                </span>
              </div>

              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.32em] text-text-secondary">
                  ExamOps
                </p>
                <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-text-primary sm:text-5xl">
                  The repo has moved from planning-only into a real Next.js
                  application foundation.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-text-secondary sm:text-lg">
                  This baseline intentionally stays narrow: real app structure,
                  typed tooling, Prisma runtime wiring, and a UI starting point
                  that matches the product direction without pretending later
                  slices are already done.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-3xl border border-border bg-surface-elevated px-4 py-4">
                  <p className="text-sm font-medium text-text-secondary">
                    English foundation note
                  </p>
                  <p className="mt-2 text-lg font-semibold text-text-primary">
                    Responsive, bilingual, and theme-aware architecture starts
                    here.
                  </p>
                </div>

                <div
                  lang="ar"
                  dir="rtl"
                  className="rounded-3xl border border-border bg-surface-elevated px-4 py-4 text-right font-arabic"
                >
                  <p className="text-sm font-medium text-text-secondary">
                    ملاحظة تأسيسية
                  </p>
                  <p className="mt-2 text-lg font-semibold text-text-primary">
                    البداية الحقيقية للتطبيق جاهزة للتوسعة مع العربية
                    والإنجليزية والاستجابة.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[1.5rem] border border-border bg-surface-elevated px-5 py-5">
                <p className="text-sm text-text-secondary">Current milestone</p>
                <p className="mt-3 text-2xl font-semibold text-text-primary">
                  App bootstrap
                </p>
                <p className="mt-2 text-sm leading-7 text-text-secondary">
                  The schema is done, and the repository now has a real runtime
                  entrypoint instead of docs alone.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-border bg-surface-elevated px-5 py-5">
                <p className="text-sm text-text-secondary">Core constraints</p>
                <p className="mt-3 text-2xl font-semibold text-text-primary">
                  2 locales
                </p>
                <p className="mt-2 text-sm leading-7 text-text-secondary">
                  Arabic and English remain first-class requirements across the
                  product surface.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-border bg-surface-elevated px-5 py-5">
                <p className="text-sm text-text-secondary">Roadmap depth</p>
                <p className="mt-3 text-2xl font-semibold text-text-primary">
                  9 phases
                </p>
                <p className="mt-2 text-sm leading-7 text-text-secondary">
                  The foundation stays small so later operational modules can
                  land on stable ground.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4 md:grid-cols-3">
            {foundationCards.map((card) => (
              <article
                key={card.title}
                className="panel rounded-panel px-5 py-5 sm:px-6"
              >
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-text-secondary">
                  {card.eyebrow}
                </p>
                <h2 className="mt-4 text-xl font-semibold text-text-primary">
                  {card.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-text-secondary">
                  {card.description}
                </p>
              </article>
            ))}
          </div>

          <aside className="panel rounded-panel px-6 py-6 sm:px-7">
            <p className="text-sm uppercase tracking-[0.28em] text-text-secondary">
              Next implementation track
            </p>
            <h2 className="mt-4 text-2xl font-semibold text-text-primary">
              What comes immediately after this slice
            </h2>
            <ol className="mt-6 space-y-4">
              {nextTrack.map((item, index) => (
                <li
                  key={item}
                  className="flex gap-4 rounded-[1.35rem] border border-border bg-surface-elevated px-4 py-4"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-7 text-text-secondary">{item}</p>
                </li>
              ))}
            </ol>
          </aside>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {productPillars.map((pillar) => (
            <article
              key={pillar.title}
              className="rounded-panel border border-border bg-surface px-5 py-5 shadow-panel"
            >
              <h2 className="text-lg font-semibold text-text-primary">
                {pillar.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-text-secondary">
                {pillar.description}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
