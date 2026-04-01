import Link from "next/link";

import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { PageHero } from "@/components/ui/page-hero";
import type { Locale, Messages } from "@/lib/i18n";
import { adminFirstRunGuide } from "@/lib/test-guide/admin-first-run-guide";

type TestGuideWorkspaceProps = {
  locale: Locale;
  messages: Messages;
};

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm leading-7 text-text-primary">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-3">
          <span className="mt-[0.72rem] h-2 w-2 shrink-0 rounded-full bg-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function OrderedList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2 text-sm leading-7 text-text-primary">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-3">
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs font-semibold text-text-secondary">
            {index + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

export function TestGuideWorkspace({ locale, messages }: TestGuideWorkspaceProps) {
  const isArabic = locale === "ar";
  const guide = adminFirstRunGuide;

  return (
    <div className="space-y-6" dir="rtl">
      <PageHero
        badges={[
          { label: messages.common.protected, variant: "accent" },
          { label: messages.testGuide.badges.adminOnly, variant: "warning" },
          { label: messages.nav.testGuide },
          { label: "First Run", variant: "success" }
        ]}
        title={guide.title}
        description={guide.subtitle}
        aside={
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              حساب التشغيل
            </p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-text-primary">
              admin@examops.local
            </p>
            <p className="mt-2 text-sm text-text-secondary">ابدأ من /login</p>
          </>
        }
        body={
          <div className="space-y-4 text-right font-arabic">
            <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
              <span>أول صفحة</span>
              <Link href="/login" className="text-accent underline underline-offset-4">
                /login
              </Link>
            </div>
            <p className="max-w-4xl text-sm leading-7 text-text-secondary">
              {guide.intro}
            </p>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {guide.cards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>{messages.nav.testGuide}</CardDescription>
            </CardHeader>
            <CardContent className="font-arabic text-right">
              <BulletList items={card.items} />
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-4">
        <div className="space-y-2 text-right font-arabic">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">Flow Order</Badge>
            <Badge>{messages.nav.testGuide}</Badge>
          </div>
          <h2 className="text-2xl font-semibold text-text-primary">
            الترتيب المقترح لأول تجربة كاملة
          </h2>
          <p className="max-w-4xl text-sm leading-7 text-text-secondary">
            امشِ على الأقسام بالترتيب نفسه. كل جزء أدناه مبني على routes وfixtures
            موجودة فعلاً داخل المشروع الحالي.
          </p>
        </div>

        <div className="space-y-4">
          {guide.sections.map((section, index) => (
            <details
              key={section.id}
              open={index === 0}
              className="rounded-panel border border-border bg-surface px-5 py-5 shadow-panel"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2 text-right font-arabic">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="success">Seeded Runtime</Badge>
                      <Badge variant="accent">Code Ordered</Badge>
                      {section.id === "advanced-admin" ? (
                        <Badge variant="warning">Optional</Badge>
                      ) : null}
                    </div>
                    <h3 className="text-xl font-semibold text-text-primary">
                      {section.title}
                    </h3>
                    <p className="max-w-3xl text-sm leading-7 text-text-secondary">
                      {section.summary}
                    </p>
                  </div>
                  {section.route ? (
                    <span className="text-sm font-medium text-text-secondary">
                      {section.route}
                    </span>
                  ) : null}
                </div>
              </summary>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-3xl border border-border bg-surface px-4 py-4 font-arabic text-right">
                  <div className="space-y-4">
                    {section.fixtures && section.fixtures.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">
                          Seed Data
                        </p>
                        <BulletList items={section.fixtures} />
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">
                        Steps
                      </p>
                      <OrderedList items={section.steps} />
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-surface px-4 py-4 font-arabic text-right">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">
                        Expected Result
                      </p>
                      <BulletList items={section.expected} />
                    </div>

                    {section.notes && section.notes.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">
                          Notes
                        </p>
                        <BulletList items={section.notes} />
                      </div>
                    ) : null}

                    {section.snippets && section.snippets.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">
                          Snippets
                        </p>
                        {section.snippets.map((snippet) => (
                          <div
                            key={snippet.label}
                            className="rounded-3xl border border-border bg-surface-elevated px-4 py-4"
                          >
                            <p className="text-sm font-semibold text-text-primary">
                              {snippet.label}
                            </p>
                            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-left text-xs leading-6 text-text-secondary">
                              {snippet.code}
                            </pre>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader className="text-right font-arabic">
          <CardTitle>Sign-off Checklist</CardTitle>
          <CardDescription>
            بعد ما تخلص المرور الكامل، استخدم القائمة دي كمرجع سريع قبل ما تقول إن
            الـ first run ناجح.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 font-arabic text-right">
          <BulletList items={guide.checklist} />

          <div className="flex flex-wrap gap-3">
            <ActionLink href="/dashboard" variant="primary">
              {messages.nav.dashboard}
            </ActionLink>
            <ActionLink href="/reports">
              {messages.dashboard.workspace.actions.openReports}
            </ActionLink>
            <Badge variant={isArabic ? "success" : "accent"}>
              {isArabic ? messages.common.rtl : messages.common.ltr}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
