import type { Metadata } from "next";
import { Cairo, Inter } from "next/font/google";

import { AppThemeProvider } from "@/components/providers/app-theme-provider";
import { getSession } from "@/lib/auth/session";
import { getDirection, resolveRequestLocale } from "@/lib/i18n";
import { siteConfig } from "@/lib/site";
import { getThemeRootClass, resolveRequestTheme } from "@/lib/theme/server";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans"
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-arabic"
});

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const [locale, theme] = await Promise.all([
    resolveRequestLocale(session?.user.preferredLanguage),
    resolveRequestTheme(session?.user.preferredTheme)
  ]);

  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      className={`${inter.variable} ${cairo.variable} ${getThemeRootClass(theme)}`.trim()}
      suppressHydrationWarning
    >
      <body className="bg-background text-text-primary">
        <AppThemeProvider defaultTheme={theme}>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
