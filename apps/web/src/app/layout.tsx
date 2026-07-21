import type { Metadata } from "next";
import { Lato, Playfair_Display } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";

import "./globals.css";

// DESIGN.md typography: Lato (400/700) for everything functional,
// Playfair Display for the wordmark and page-level headings only.
const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Sentinel Watch",
    template: "%s — Sentinel Watch",
  },
  description:
    "Safeguarding intelligence for UK schools and Multi-Academy Trusts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-GB"
      className={`${lato.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
