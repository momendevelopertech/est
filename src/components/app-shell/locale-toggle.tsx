"use client";

import { useTransition } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { GlobeIcon } from "@/components/ui/icons";
import type { Locale, Messages } from "@/lib/i18n";

type LocaleToggleProps = {
  locale: Locale;
  messages: Messages;
};

export function LocaleToggle({ locale, messages }: LocaleToggleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const nextLocale = locale === "ar" ? "en" : "ar";

  function handleLocaleChange() {
    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/preferences/locale", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            locale: nextLocale
          })
        });

        if (response.ok) {
          router.refresh();
        }
      })();
    });
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleLocaleChange}
      disabled={isPending}
      aria-label={messages.shell.locale}
      title={messages.shell.locale}
      className="gap-1.5 rounded-xl px-2.5"
    >
      <GlobeIcon />
      <span className="text-xs font-semibold uppercase">
        {nextLocale === "ar" ? "AR" : "EN"}
      </span>
    </Button>
  );
}
