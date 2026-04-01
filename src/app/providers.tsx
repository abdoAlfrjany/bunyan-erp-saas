"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // ═══ Performance: تجنب إعادة الجلب الفوري بعد SSR ═══
            staleTime: 5 * 60 * 1000, // 5 دقائق
            // ═══ Memory: تنظيف البيانات غير المستخدمة بعد 10 دقائق ═══
            gcTime: 10 * 60 * 1000,
            // ═══ لا نعيد الجلب عند العودة للنافذة (ERP لا يحتاجها) ═══
            refetchOnWindowFocus: false,
            // ═══ Retry: محاولة واحدة فقط لتقليل الانتظار ═══
            retry: 1,
            retryDelay: 1000,
          },
          mutations: {
            // ═══ Retry: لا نعيد المحاولة للعمليات الكتابية ═══
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
