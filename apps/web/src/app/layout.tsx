import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";

import "./globals.css";

// DESIGN.md v2 typography: a single sans family throughout. Weights 400
// body / 500 labels / 600 headings and KPI numbers — nothing heavier in-app.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
    <html lang="en-GB" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
