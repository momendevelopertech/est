"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Messages } from "@/lib/i18n";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

function isStandaloneMode() {
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }

  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };

  return Boolean(navigatorWithStandalone.standalone);
}

export function PwaInstallPrompt({ messages }: { messages: Messages }) {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setIsInstalled(isStandaloneMode());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (isInstalled || !deferredPrompt) {
    return null;
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={isInstalling}
      onClick={() => {
        void (async () => {
          if (!deferredPrompt) {
            return;
          }

          try {
            setIsInstalling(true);
            await deferredPrompt.prompt();
            const choice = await deferredPrompt.userChoice;

            if (choice.outcome === "accepted") {
              setIsInstalled(true);
            }
          } finally {
            setDeferredPrompt(null);
            setIsInstalling(false);
          }
        })();
      }}
    >
      {isInstalling ? messages.pwa.install.installing : messages.pwa.install.cta}
    </Button>
  );
}
