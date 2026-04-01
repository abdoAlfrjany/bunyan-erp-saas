// src/app/api/health/route.ts
// الوظيفة: Health Check endpoint — يُستخدم لمراقبة حالة النظام
// 🔓 عام — بدون auth (مطلوب لـ uptime monitors)

import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
}
