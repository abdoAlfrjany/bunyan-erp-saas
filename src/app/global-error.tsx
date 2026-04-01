'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 p-4 text-center">
          <div className="mx-auto flex max-w-[500px] flex-col items-center justify-center space-y-6 rounded-2xl bg-white p-8 shadow-2xl">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">حدث خطأ نظامي حرج</h2>
              <p className="text-sm text-gray-500">
                لقد واجه النظام مشكلة غير متوقعة في الطبقات الأساسية. الرجاء محاولة إعادة تحميل الصفحة أو التواصل مع الدعم الفني.
              </p>
              {process.env.NODE_ENV === 'development' && (
                <div style={{direction: "ltr"}} className="mt-4 rounded bg-red-50 p-3 text-xs text-red-800 break-words text-left overflow-auto max-h-[200px] font-mono shadow-inner">
                  {error.message}
                </div>
              )}
            </div>
            <button
              onClick={() => reset()}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-700 active:scale-95"
            >
              إعادة تحميل النظام
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
