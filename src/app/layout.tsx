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
  // NB: deliberately NOT setting `apple-mobile-web-app-capable`. On iOS 16.4+
  // the manifest's `display: standalone` drives standalone mode AND honors the
  // manifest `scope`, keeping in-app navigation inside the app. The legacy
  // `apple-mobile-web-app-capable` tag flips iOS into web-clip mode, which
  // ignores `scope` and confines the app to the start_url path — so every
  // sibling route (/checklists, /clients, …) opened in the Safari in-app
  // browser. Leaving it off is what keeps navigation in-app.
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
