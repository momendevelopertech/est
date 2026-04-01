"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { usePathname } from "next/navigation";

import type { SessionUser } from "@/lib/auth/types";
import type { Locale, Messages } from "@/lib/i18n";
import { getNavigation } from "@/lib/navigation";

import { Header } from "./header";
import { PageTransition } from "./page-transition";
import { Sidebar } from "./sidebar";

type ShellProps = {
  children: ReactNode;
  locale: Locale;
  messages: Messages;
  user: SessionUser;
};

export function AppShell({ children, locale, messages, user }: ShellProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigation = getNavigation(messages).filter((item) =>
    item.roles.includes(user.role)
  );

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen">
      <Sidebar
        locale={locale}
        user={user}
        messages={messages}
        navigation={navigation}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="min-h-screen lg:pr-[18rem]">
        <Header
          locale={locale}
          messages={messages}
          navigation={navigation}
          user={user}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />

        <main className="min-h-[calc(100vh-5rem)] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
