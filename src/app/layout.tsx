import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";

import { AppThemeProvider } from "@/components/providers/app-theme-provider";
import { PwaRegistration } from "@/components/providers/pwa-registration";
import { getSession } from "@/lib/auth/session";
import { getDirection, resolveRequestLocale } from "@/lib/i18n";
import { siteConfig } from "@/lib/site";
import { getThemeRootClass, resolveRequestTheme } from "@/lib/theme/server";

import "./globals.css";

const cairoSans = Cairo({
  subsets: ["arabic", "latin"],
  display: "swap",
  weight: ["400", "600", "700"],
  variable: "--font-sans"
});

const cairoArabic = Cairo({
  subsets: ["arabic", "latin"],
  display: "swap",
  weight: ["400", "600", "700"],
  variable: "--font-arabic"
});

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/logo.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)"
      },
      {
        url: "/logo-dark.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)"
      }
    ],
    shortcut: [
      {
        url: "/logo.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)"
      },
      {
        url: "/logo-dark.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)"
      }
    ]
  },
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
      color: "#f9fafb"
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: "#06080c"
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
      className={`${cairoSans.variable} ${cairoArabic.variable} ${getThemeRootClass(theme)}`.trim()}
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
