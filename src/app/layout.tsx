// src/app/layout.tsx
// الوظيفة: الـ Root Layout لمنظومة Bunyan — RTL + اللغة العربية + الخط Cairo + ToastProvider
// لا يحتوي على أي business logic

import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};
import { ToastProvider } from "@/shared/components/ui/Toast";
import { ThemeProvider } from "@/shared/components/ui/ThemeProvider";
import { AuthListener } from "@/core/auth/AuthListener";
import { Providers } from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bunyan — نظام إدارة الأعمال",
  description: "Bunyan — نظام إدارة المتاجر الليبية السحابي الاحترافي",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bunyan ERP",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">
        <ThemeProvider>
          <AuthListener />
          <Providers>
            <ToastProvider>
              {children}
            </ToastProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
