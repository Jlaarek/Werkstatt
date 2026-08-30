import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Säp — Aus allem eine App",
  description:
    "Säp ist der beste App-Programmierer der Welt. Beschreibe deine Idee — Säp baut daraus eine vollständige App.",
  keywords: ["App Builder", "No-Code", "App erstellen", "Säp"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={`${outfit.variable} ${jetbrains.variable}`}>
      <body className="font-display antialiased">{children}</body>
    </html>
  );
}
