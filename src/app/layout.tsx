import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fantasy Coach — Le fond de la classe (Sofascore 2026/27)",
  description:
    "Copilote de coaching pour ta ligue privée Sofascore Fantasy Premier League : équipe réelle Vital_GDB, classement réel, prix et fixtures officiels, capitaine, transferts et assistant IA ancré sur les données réelles.",
  keywords: ["Sofascore Fantasy", "Premier League", "coach", "Le fond de la classe", "Vital_GDB", "données réelles"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
