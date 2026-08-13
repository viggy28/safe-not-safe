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
  title: "Is my migration safe?",
  description:
    "Paste a Postgres migration and get an instant SAFE or NOT SAFE verdict in your browser.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Is my migration safe?",
    description:
      "A privacy-first Postgres migration checker that gives a screenshotable SAFE or NOT SAFE verdict.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Is my migration safe?",
    description:
      "Paste SQL, keep it local, get the migration verdict.",
    images: ["/og.png"],
  },
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
