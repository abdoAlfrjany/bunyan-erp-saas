// src/app/page.tsx
// الوظيفة: الصفحة الرئيسية — تحويل تلقائي إلى صفحة تسجيل الدخول

import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/login');
}
