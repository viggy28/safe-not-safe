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
  metadataBase: new URL("https://is-my-migration-safe.viggy28.chatgpt.site"),
  title: "Is my migration safe?",
  description:
    "A local-first Postgres migration safety checker for developers.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Is my migration safe?",
    description:
      "Paste SQL, parse it locally, and catch Postgres migration lock and rewrite risks before deploy.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Is my migration safe?",
    description:
      "Developer-focused Postgres migration safety checks that run in your browser.",
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
