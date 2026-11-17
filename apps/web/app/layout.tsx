import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { Header } from "../components/header";
import { ToastProvider } from "../components/ui/toast";
import "./globals.css";

const display = localFont({
  src: [
    { path: "../public/fonts/big-shoulders-display-latin-700-normal.woff2", weight: "700" },
    { path: "../public/fonts/big-shoulders-display-latin-800-normal.woff2", weight: "800" },
    { path: "../public/fonts/big-shoulders-display-latin-900-normal.woff2", weight: "900" },
  ],
  variable: "--font-display",
  display: "swap",
});

const body = localFont({
  src: [
    { path: "../public/fonts/instrument-sans-latin-400-normal.woff2", weight: "400" },
    { path: "../public/fonts/instrument-sans-latin-500-normal.woff2", weight: "500" },
    { path: "../public/fonts/instrument-sans-latin-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClipDesk",
  description: "Turn a downloaded YouTube stream VOD into YouTube Shorts.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen bg-surface font-body text-ink">
        <ToastProvider>
          <Header />
          <main className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
