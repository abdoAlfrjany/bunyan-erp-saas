// src/app/layout.tsx
// الوظيفة: الـ Root Layout لمنظومة Bunyan — RTL + اللغة العربية + الخط Cairo + ToastProvider
// لا يحتوي على أي business logic

import type { Metadata } from "next";
import { ToastProvider } from "@/shared/components/ui/Toast";
import { ThemeProvider } from "@/shared/components/ui/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bunyan — نظام إدارة الأعمال",
  description: "Bunyan — نظام إدارة المتاجر الليبية السحابي الاحترافي",
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
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
