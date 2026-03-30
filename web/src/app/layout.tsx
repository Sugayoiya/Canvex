import type { Metadata } from "next";
import { Space_Grotesk, Manrope } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Canvex",
  description: "AI-powered storyboard & video production workbench",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh"
      className={`${spaceGrotesk.variable} ${manrope.variable} h-full antialiased dark`}
    >
      <body
        className="min-h-full flex flex-col"
        style={{ background: "var(--ob-surface-base)", color: "var(--ob-text-primary)" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
