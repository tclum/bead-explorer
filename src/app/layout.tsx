import type { Metadata } from "next";
import "./globals.css";

const BUILD_SHA = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? "dev";

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
    <html lang="en">
      <head>
        <meta name="build-stamp" content={BUILD_SHA} />
      </head>
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
