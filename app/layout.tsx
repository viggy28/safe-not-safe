import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "700", "800"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
        className={`${instrumentSans.variable} ${jetbrainsMono.variable} ${ibmPlexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
