import type { Metadata } from "next";
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
  title: "Dimo Dimov (Innsyn Ltd)",
  description: "Learning and building the future together.",
  openGraph: {
    title: "Dimo Dimov (Innsyn Ltd)",
    description: "Learning and building the future together.",
    type: "website",
    siteName: "Dimo Dimov Research Portfolio",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dimo Dimov (Innsyn Ltd)",
    description: "Learning and building the future together.",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
