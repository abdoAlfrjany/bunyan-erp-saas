// netlify/functions/auto-apply-settlements.mts
// الوظيفة: مهمة مجدولة كل 15 دقيقة للكشف عن تسويات فانكس المدفوعة
//          وإدخال مبالغها آلياً في خزينة كل مستأجر (tenant) دون تدخل يدوي
// ⏱ حد الزمن: 30 ثانية (Netlify Scheduled Function limit)
// 🔒 تعمل فقط على الـ published deploys

import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const VANEX_BASE = "https://app.vanex.ly/api/v1";
const MAX_RUNTIME_MS = 25_000; // نوقف المعالجة بعد 25 ثانية لنضمن الرد قبل الـ 30 ثانية

// ── جلب التسويات المدفوعة (paid) مباشرة من Vanex API ──
async function fetchPaidSettlements(token: string): Promise<VanexRawSettlement[]> {
  try {
    const clean = token.replace(/^["']|["']$/g, "").trim();
    const res = await fetch(`${VANEX_BASE}/store/settelmets?status=paid`, {
      headers: {
        Authorization: `Bearer ${clean}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return [];
    const json = await res.json();
    // فانكس تُرجع البيانات في data.data أو data مباشرةً
    const list = json?.data?.data ?? json?.data ?? [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

interface VanexRawSettlement {
  id: number;
  amount?: number;
  total_amount?: number;
  settlement_number?: string;
  status?: string;
  payment_method?: { id: number; name: string; name_en: string };
  packages?: { shipping_cost?: number }[];
  created_at?: string;
}

// ── تحليل طريقة الدفع وحساب الصافي ──
function parseSettlement(s: VanexRawSettlement) {
  const grossAmount   = Math.round(s.total_amount ?? s.amount ?? 0);
  const paymentNameEn = (s.payment_method?.name_en ?? "").toLowerCase();
  const isOnline      = paymentNameEn.includes("online") || paymentNameEn.includes("electronic");
  const isCash        = paymentNameEn.includes("cash");
  const bankCommission = isOnline ? Math.round(grossAmount * 0.02) : 0;
  const netAmount      = grossAmount - bankCommission;
  const paymentMethod  = isCash ? "cash" : isOnline ? "online" : "bank_transfer";
  const targetAccountType = isCash ? "cash_in_hand" : "bank";

  return { grossAmount, bankCommission, netAmount, paymentMethod, targetAccountType };
}

export default async (req: Request) => {
  const startTime = Date.now();

  const supabase = createClient(
    Netlify.env.get("NEXT_PUBLIC_SUPABASE_URL")!,
    Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // ── 1. جلب كل شركات التوصيل Vanex من كل المستأجرين ──
  const { data: couriers, error: courierErr } = await supabase
    .from("couriers")
    .select("id, tenant_id, api_credentials")
    .eq("api_provider", "vanex")
    .not("api_credentials->token", "is", null);

  if (courierErr || !couriers?.length) {
    console.log("[auto-apply-settlements] No Vanex couriers found or DB error:", courierErr?.message);
    return;
  }

  let totalApplied = 0;
  let totalSkipped = 0;
  let totalErrors  = 0;

  for (const courier of couriers) {
    // ── حارس الوقت: نوقف قبل نفاد الـ 30 ثانية ──
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.warn("[auto-apply-settlements] Time budget exhausted — stopping early");
      break;
    }

    const token: string | undefined = courier.api_credentials?.token;
    if (!token) continue;

    // ── 2. جلب التسويات المدفوعة من فانكس لهذا المستأجر ──
    const paidSettlements = await fetchPaidSettlements(token);
    if (!paidSettlements.length) continue;

    for (const vs of paidSettlements) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) break;

      const vanexId = vs.id;
      if (!vanexId) continue;

      // ── 3. التحقق: هل التسوية مطبّقة مسبقاً في قاعدة بياناتنا؟ ──
      const { data: existing } = await supabase
        .from("vanex_settlements")
        .select("id, status, net_amount, target_account_type, settlement_number, package_count")
        .eq("tenant_id", courier.tenant_id)
        .eq("vanex_settlement_id", vanexId)
        .maybeSingle();

      // تجاوز إذا كانت مطبّقة مسبقاً
      if (existing?.status === "applied") {
        totalSkipped++;
        continue;
      }

      // ── 4. حساب القيم المالية ──
      const parsed = parseSettlement(vs);

      // نفضّل القيم المحفوظة مسبقاً (أدق لأنها قد تحتوي delivery_fees)
      const netAmount      = existing?.net_amount
        ? Number(existing.net_amount)
        : parsed.netAmount;
      const targetAccType  = existing?.target_account_type ?? parsed.targetAccountType;
      const settlementNum  = existing?.settlement_number ?? String(vanexId);

      if (netAmount <= 0) {
        totalSkipped++;
        continue;
      }

      // ── 5. جلب حساب الخزينة المناسب ──
      const { data: treasuryAccount } = await supabase
        .from("treasury_accounts")
        .select("id")
        .eq("tenant_id", courier.tenant_id)
        .eq("account_type", targetAccType)
        .maybeSingle();

      if (!treasuryAccount) {
        console.warn(
          `[auto-apply-settlements] No treasury (${targetAccType}) for tenant ${courier.tenant_id} — settlement ${vanexId} skipped`
        );
        totalErrors++;
        continue;
      }

      const description = `تسوية فانكس #${settlementNum} — تطبيق آلي`;

      // ── 6. تسجيل الحركة المالية ذرياً في الخزينة ──
      const { error: rpcError } = await supabase.rpc("create_treasury_transaction_atomic", {
        p_tenant_id:       courier.tenant_id,
        p_account_id:      treasuryAccount.id,
        p_transaction_type: "sale",
        p_amount:          netAmount,
        p_description:     description,
        p_created_by:      null, // system — لا يوجد مستخدم بشري
        p_transaction_date: new Date().toISOString().split("T")[0],
        p_is_transfer:     false,
        p_to_account_id:   null,
      });

      if (rpcError) {
        console.error(
          `[auto-apply-settlements] RPC error for settlement ${vanexId}:`,
          rpcError.message
        );
        totalErrors++;
        continue;
      }

      // ── 7. تحديث/إدراج سجل التسوية وتمييزها كـ "مطبّقة" ──
      const now = new Date().toISOString();
      if (existing) {
        // سجل موجود → نحدّث فقط
        await supabase
          .from("vanex_settlements")
          .update({ status: "applied", applied_at: now })
          .eq("id", existing.id);
      } else {
        // سجل غير موجود → نُدرج بحالة applied مباشرة
        await supabase.from("vanex_settlements").insert({
          tenant_id:           courier.tenant_id,
          courier_company_id:  courier.id,
          vanex_settlement_id: vanexId,
          settlement_number:   settlementNum,
          total_amount:        parsed.grossAmount,
          delivery_fees:       0,
          bank_commission:     parsed.bankCommission,
          net_amount:          netAmount,
          payment_method:      parsed.paymentMethod,
          target_account_type: targetAccType,
          package_count:       vs.packages?.length ?? 0,
          is_approximate:      true,
          status:              "applied",
          applied_at:          now,
          created_at:          vs.created_at ?? now,
        });
      }

      console.log(
        `[auto-apply-settlements] ✅ Applied settlement ${settlementNum} — ${netAmount} LYD → tenant ${courier.tenant_id}`
      );
      totalApplied++;
    }
  }

  console.log(
    `[auto-apply-settlements] Done in ${Date.now() - startTime}ms | Applied: ${totalApplied} | Skipped: ${totalSkipped} | Errors: ${totalErrors}`
  );
};

export const config: Config = {
  schedule: "*/15 * * * *", // كل 15 دقيقة (UTC)
};
