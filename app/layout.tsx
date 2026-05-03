import type { Metadata } from "next";
import { Syne, DM_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "ReviewLens — AI Review Intelligence",
  description:
    "Paste any Amazon, G2, or Trustpilot URL. Get an AI-powered analysis of what customers love and hate in 30 seconds.",
  openGraph: {
    title: "ReviewLens — AI Review Intelligence",
    description: "Know exactly what customers love and hate about any product.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmMono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
