import type { Metadata, Viewport } from "next";
import { Cairo, Manrope } from "next/font/google";

import { AppThemeProvider } from "@/components/providers/app-theme-provider";
import { PwaRegistration } from "@/components/providers/pwa-registration";
import { getSession } from "@/lib/auth/session";
import { getDirection, resolveRequestLocale } from "@/lib/i18n";
import { siteConfig } from "@/lib/site";
import { getThemeRootClass, resolveRequestTheme } from "@/lib/theme/server";

import "./globals.css";

const manrope = Manrope({
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
  description: siteConfig.description,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.name
  }
};

export const viewport: Viewport = {
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: "#f4f7fb"
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: "#07111f"
    }
  ]
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
      className={`${manrope.variable} ${cairo.variable} ${getThemeRootClass(theme)}`.trim()}
      suppressHydrationWarning
    >
      <body className="bg-background text-text-primary">
        <AppThemeProvider defaultTheme={theme}>
          <PwaRegistration />
          {children}
        </AppThemeProvider>
      </body>
    </html>
  );
}
