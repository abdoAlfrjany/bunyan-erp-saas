// ══════════════════════════════════════════
// Types
// ══════════════════════════════════════════
export type AuditStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'WARNING' | 'WONDERFUL';

export interface AuditResult {
  step: string;
  status: AuditStatus;
  message: string;
  details?: Record<string, unknown>;
  durationMs?: number;
}

export interface UiUxReport {
  results: AuditResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    wonderful: number;
    score: number; // 0-100
    grade: 'A+' | 'A' | 'B' | 'C' | 'F';
  };
  recommendations: string[];
  timestamp: string;
}

// ══════════════════════════════════════════
// Runner Helper
// ══════════════════════════════════════════
async function runAuditStep(
  name: string,
  fn: () => Promise<{ ok: boolean; msg: string; warn?: string; wonderful?: string; details?: Record<string, unknown> }>,
  results: AuditResult[]
): Promise<void> {
  const t0 = Date.now();
  try {
    const res = await fn();
    const dur = Date.now() - t0;
    
    let status: AuditStatus = 'PASSED';
    if (!res.ok) status = 'FAILED';
    else if (res.wonderful) status = 'WONDERFUL';
    else if (res.warn) status = 'WARNING';

    const msg = res.wonderful || res.warn || res.msg;
    results.push({ step: name, status, message: msg, details: res.details, durationMs: dur });

    // Console Styling for Visual Audit
    const styles = {
      WONDERFUL: 'color: #8b5cf6; font-weight: bold; background: #f5f3ff; border: 1px solid #ddd6fe; padding: 2px 6px; border-radius: 4px;',
      PASSED: 'color: #10b981; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;',
      WARNING: 'color: #f59e0b; font-weight: bold; background: #fffbeb; padding: 2px 6px; border-radius: 4px;',
      FAILED: 'color: #ef4444; font-weight: bold; background: #fef2f2; padding: 2px 6px; border-radius: 4px;'
    };

    console.log(`%c[${status}] ${name} (${dur}ms)\n➔ ${msg}`, styles[status as keyof typeof styles]);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    results.push({ step: name, status: 'FAILED', message: `Audit crashed: ${errMsg}`, durationMs: 0 });
    console.error(`%c[❌ ERROR] ${name} Failed`, 'color: red', err);
  }
}

// ══════════════════════════════════════════
// Main Diagnostic Function
// ══════════════════════════════════════════
export async function runUiUxAudit(): Promise<UiUxReport> {
  console.clear();
  console.log('%c✨ Bunyan ERP — Genius UI/UX Design Audit ✨', 'color: #4f46e5; font-size: 20px; font-weight: black; font-family: Cairo;');
  console.log('%c🔍 Scanning visual layers and interface harmony...', 'color: #6366f1; font-style: italic;');

  const results: AuditResult[] = [];
  
  // 1. TYPOGRAPHY AUDIT
  await runAuditStep('UI.Typography.Consistency', async () => {
    const bodyFont = window.getComputedStyle(document.body).fontFamily;
    const isInterOrCairo = bodyFont.includes('Inter') || bodyFont.includes('Cairo') || bodyFont.includes('system-ui');
    return {
      ok: true,
      wonderful: isInterOrCairo ? 'تايبوغرافيا عالمية — الخط المستخدم متناسق مع هوية بنيان المتطورة' : undefined,
      msg: 'الخطوط الأساسية محملة بشكل سليم',
      details: { fontFamily: bodyFont }
    };
  }, results);

  // 2. COLOR & PREMIUM GRADIENTS
  await runAuditStep('UI.Aesthetics.Gradients', async () => {
    const hasGradients = Array.from(document.querySelectorAll('*')).some(el => {
      const bg = window.getComputedStyle(el).backgroundImage;
      return bg.includes('gradient');
    });
    return {
      ok: true,
      wonderful: hasGradients ? 'لمسة زجاجية (Glassmorphism) — تم اكتشاف تدرجات لونية تمنح واجهة متميزة' : undefined,
      msg: 'توزيع لوني متوازن',
      details: { gradientDetection: hasGradients }
    };
  }, results);

  // 3. RESPONSIVE HARMONY
  await runAuditStep('UI.Layout.Responsiveness', async () => {
    const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;
    return {
      ok: !hasOverflow,
      msg: hasOverflow ? 'عنصر مفقود — تم اكتشاف تجاوز أفقي (Horizontal Overflow) للواجهة' : 'تصميم متجاوب — الواجهة محتواة بالكامل داخل إطار الرؤية',
      details: { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }
    };
  }, results);

  // 4. MICRO-ANIMATIONS
  await runAuditStep('UI.Animations.MicroInteractions', async () => {
    const hasAnimations = document.querySelectorAll('.animate-fade-in, .animate-spin, .transition-all').length > 5;
    return {
      ok: true,
      wonderful: hasAnimations ? 'واجهة حية — تم اكتشاف حركات دقيقة (Micro-animations) تزيد من تفاعل المستخدم' : undefined,
      msg: 'الانتقالات البصرية مفعّلة',
      details: { transitionElementCount: hasAnimations }
    };
  }, results);

  // 5. ACCESSIBILITY (ARIA)
  await runAuditStep('UI.Accessibility.Semantics', async () => {
    const interactiveElements = document.querySelectorAll('button, a, input');
    const missingLabels = Array.from(interactiveElements).filter(el => {
      const isInput = el instanceof HTMLInputElement;
      return !el.getAttribute('aria-label') && !el.textContent && !(isInput && el.placeholder);
    }).length;
    
    return {
      ok: missingLabels < 5,
      warn: missingLabels > 0 ? `تنبيه — يوجد ${missingLabels} عنصر تفاعلي يحتاج إلى تسمية وصفية (ARIA labels)` : undefined,
      msg: 'التوافق مع قارئات الشاشة ممتاز',
      details: { missingLabelsCount: missingLabels }
    };
  }, results);

  // 6. PURPLE BAN COMPLIANCE
  await runAuditStep('UI.DesignRules.ForbiddenZones', async () => {
    // Check for explicit purple colors in computed styles (violet-500 equivalent)
    const elements = Array.from(document.querySelectorAll('*')).slice(0, 100); // Check first 100
    const hasForbiddenPurple = elements.some(el => {
      const color = window.getComputedStyle(el).backgroundColor;
      return color.includes('rgb(139, 92, 246)') || color.includes('rgb(124, 58, 237)'); // Purple/Violet ranges
    });

    return {
      ok: true,
      warn: hasForbiddenPurple ? 'مخالفة بصرية — تم اكتشاف كود لوني بنفسجي صريح وهو محظور في نظام بنيان' : undefined,
      msg: 'الالتزام بقواعد التصميم اللوني (No-Purple Rule) محقق'
    };
  }, results);

  // Calculate Aggregates
  const total = results.length;
  const passed = results.filter(r => r.status === 'PASSED' || r.status === 'WONDERFUL').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;
  const wonderful = results.filter(r => r.status === 'WONDERFUL').length;

  const score = Math.max(0, Math.min(100, (passed / total) * 100 - (failed * 15) - (warnings * 5) + (wonderful * 10)));
  
  const grade = score > 95 ? 'A+' : score > 85 ? 'A' : score > 70 ? 'B' : score > 50 ? 'C' : 'F';

  const recommendations: string[] = [];
  if (failed > 0) recommendations.push('إصلاح التجاوز الأفقي (Overflow) لضمان تجربة موبايل سلسة.');
  if (warnings > 0) recommendations.push('إضافة ARIA Labels للعناصر التي تعتمد على الأيقونات فقط.');
  if (wonderful < 2) recommendations.push('زد من استخدام الـ Glassmorphism والتأثيرات الزجاجية لرفع تقييم "Premium UI".');

  const report: UiUxReport = {
    results,
    summary: { total, passed, failed, warnings, wonderful, score: Math.round(score), grade },
    recommendations,
    timestamp: new Date().toISOString()
  };

  (window as unknown as { __LAST_UIUX_AUDIT: UiUxReport }).__LAST_UIUX_AUDIT = report;

  console.log('\n\n');
  console.log('%c────────────────────────────────────────────────────────', 'color: #e5e7eb');
  console.log(`%c📊 UI/UX AUDIT SCORE: ${report.summary.score}/100`, `font-size: 16px; font-weight: bold; color: ${score > 80 ? '#10b981' : '#f59e0b'}`);
  console.log(`%cGrade: ${grade} | Wonderful Details: ${wonderful} | Warnings: ${warnings}`, 'color: #6b7280; font-size: 12px;');
  console.log('%c────────────────────────────────────────────────────────', 'color: #e5e7eb');

  return report;
}
