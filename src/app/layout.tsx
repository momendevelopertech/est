import type { Metadata } from "next";
import { Cairo, Inter } from "next/font/google";

import { getSession } from "@/lib/auth/session";
import { getDirection, resolveRequestLocale } from "@/lib/i18n";
import { siteConfig } from "@/lib/site";

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
  const locale = await resolveRequestLocale(session?.user.preferredLanguage);

  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      className={`${inter.variable} ${cairo.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
