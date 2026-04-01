'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // يمكن ربط هذا التسجيل بخدمات مثل Sentry لمراقبة الأخطاء في الإنتاج
    console.error('App-level error caught by error.tsx boundary:', error);
  }, [error]);

  return (
    <div className="flex min-h-[80vh] w-full flex-col items-center justify-center p-4 text-center">
      <div className="mx-auto flex max-w-[450px] flex-col items-center justify-center space-y-5 rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
          <svg className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">عذراً، حدث خطأ ما بالغلاف الخارجي</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            لم نتمكن من إتمام هذه العملية و عرض الصفحة بشكل صحيح. يعتذر مهندسوا النظام عن ذلك، يمكنك المحاولة مرة أخرى بالضغط على الزر أدناه.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <div style={{direction: "ltr"}} className="mt-4 rounded bg-red-50 p-3 text-xs text-red-800 break-words text-left overflow-auto max-h-[150px] font-mono">
              <strong>Error:</strong> {error.message}
            </div>
          )}
        </div>
        <button
          onClick={() => reset()}
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 active:scale-95"
        >
          حاول مرة أخرى
        </button>
      </div>
    </div>
  );
}
