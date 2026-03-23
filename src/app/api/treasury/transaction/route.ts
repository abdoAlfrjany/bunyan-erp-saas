// src/app/api/treasury/transaction/route.ts
// ⚠️ هذا المسار مُعطَّل بشكل متعمد — كان يحتوي على منطق خاطئ
// استخدم /api/treasury/transactions بدلاً منه

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { 
      success: false, 
      error: 'هذا المسار مُعطَّل. استخدم /api/treasury/transactions بدلاً منه.' 
    }, 
    { status: 410 } // 410 Gone
  );
}
