import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const BUILD_SHA = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? "dev";

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["opsz"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Hawaiʻi BEAD Explorer",
  description:
    "A weekend exploration of Hawaiʻi's public BEAD documents. Answers are grounded only in the loaded sources; every value shows its receipt.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jetbrains.variable}`}>
      <head>
        <meta name="build-stamp" content={BUILD_SHA} />
      </head>
      <body className="bg-ink-950 text-paper antialiased">{children}</body>
    </html>
  );
}
