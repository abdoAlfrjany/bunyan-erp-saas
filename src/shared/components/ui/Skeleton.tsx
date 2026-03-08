// src/shared/components/ui/Skeleton.tsx
// الوظيفة: مكونات Skeleton Loading — مستطيلات رمادية متحركة
// القاعدة: لا Spinner أبداً — Skeleton فقط
// المرجع: _DOCS/3_UI_UX_GUIDELINES.md

export function SkeletonLine({ width = '100%', height = '16px' }: { width?: string; height?: string }) {
  return <div className="bg-[#e2e6ed] rounded-lg animate-pulse" style={{ width, height }} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-[#e2e6ed] p-5 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#e2e6ed] rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[#e2e6ed] rounded-lg w-1/3" />
          <div className="h-3 bg-[#e2e6ed] rounded-lg w-2/3" />
        </div>
      </div>
      <div className="h-8 bg-[#e2e6ed] rounded-lg" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e2e6ed] overflow-hidden animate-pulse">
      <div className="bg-[#f0f2f7] px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => <div key={i} className="h-3 bg-[#d1d5db] rounded flex-1" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-4 py-3 flex gap-4 border-b border-[#e2e6ed]">
          {Array.from({ length: cols }).map((_, c) => <div key={c} className="h-3 bg-[#e2e6ed] rounded flex-1" />)}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#e2e6ed] p-5 animate-pulse">
          <div className="h-3 bg-[#e2e6ed] rounded-lg w-1/2 mb-3" />
          <div className="h-6 bg-[#e2e6ed] rounded-lg w-2/3" />
        </div>
      ))}
    </div>
  );
}
