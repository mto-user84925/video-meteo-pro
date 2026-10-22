import type { Metadata, Viewport } from "next";
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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://video-meteo-pro.vercel.app";
const DESCRIPTION =
  "Régie broadcast Météo-Climat Pro : rédaction d'articles météo, éditeur de scènes et génération automatisée de bulletins vidéo TikTok 9:16 et Paysage 16:9 avec voix off studio.";

// BUG corrigé : la page exposait encore les métadonnées du template
// (`<title>Create Next App</title>` + `lang="en"`), ce qui dégrade le SEO
// et l'accessibilité en français.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Studio Vidéo Météo — Météo-Climat Pro",
    template: "%s — Météo-Climat Pro",
  },
  description: DESCRIPTION,
  applicationName: "Video Météo Pro",
  authors: [{ name: "Météo-Climat Pro" }],
  keywords: [
    "météo",
    "bulletins météo vidéo",
    "prévisions",
    "AROME",
    "ARPEGE",
    "GFS",
    "TikTok météo",
    "régie broadcast",
  ],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Météo-Climat Pro",
    title: "Studio Vidéo Météo — Météo-Climat Pro",
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Studio Vidéo Météo — Météo-Climat Pro",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
