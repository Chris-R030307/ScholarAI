import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ScholarAI",
  description:
    "Personal academic search: Semantic Scholar–backed discovery, filters, and research assist.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        <header className="shrink-0 border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:px-6">
            <BookOpen
              className="size-7 text-emerald-700 dark:text-emerald-400"
              aria-hidden
            />
            <span className="text-lg font-semibold tracking-tight">
              ScholarAI
            </span>
            <span className="ml-1 hidden text-sm text-zinc-500 sm:inline dark:text-zinc-400">
              research search
            </span>
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
