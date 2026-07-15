// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "239 Home Services — Home Watch CRM",
  description: "Property inspection checklists and reports for 239 Home Services.",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "239 CRM",
    statusBarStyle: "default",
  },
  // Next's appleWebApp block only emits the modern `mobile-web-app-capable`
  // (Android/Chrome), which iOS ignores. Without the legacy
  // `apple-mobile-web-app-capable`, iOS launches the home-screen app standalone
  // (via the manifest) but bounces every in-app link into the Safari in-app
  // browser. This tag is the signal iOS actually keys off — keep it.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

// Tint the mobile browser chrome (iOS status bar / Safari toolbar) to match
// the white app header instead of Safari's default grey.
export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
