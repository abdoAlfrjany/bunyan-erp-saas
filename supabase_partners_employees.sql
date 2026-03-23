-- ==========================================================
-- 🚀 Bunyan ERP — System Diagnostics & Repair
-- Phase 2: Partners & Employees SQL Migration Script
-- ==========================================================

-- 1. جدول الشركاء (Partners)
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    profit_percentage NUMERIC DEFAULT 0,
    capital_contribution NUMERIC DEFAULT 0,
    wallet_balance NUMERIC DEFAULT 0,
    debt_balance NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    partner_role TEXT DEFAULT 'active_partner',
    delivery_fee_per_order NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. جدول الموظفين (Employees)
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    salary NUMERIC DEFAULT 0,
    start_date TIMESTAMPTZ DEFAULT now(),
    salary_day INTEGER DEFAULT 25,
    advance_balance NUMERIC DEFAULT 0,
    allowance_balance NUMERIC DEFAULT 0,
    deduction_balance NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    has_system_access BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'active',
    job_title TEXT,
    employment_type TEXT,
    national_id TEXT,
    personal_address TEXT,
    last_payment_date TIMESTAMPTZ,
    last_payroll_date TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- تفعيل الـ Row Level Security (RLS) للجدولين
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 🔒 RLS Policies للجداول الجديدة
-- تعتمد على تواجد المستخدم داخل الـ Tenant
-- ==========================================================

-- 1. سياسات شركاء العمل (Partners)
CREATE POLICY "Users can view partners in their tenant" ON public.partners
    FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Owners can insert partners" ON public.partners
    FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Owners can update partners" ON public.partners
    FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Owners can delete partners" ON public.partners
    FOR DELETE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- 2. سياسات الموظفين (Employees)
CREATE POLICY "Users can view employees in their tenant" ON public.employees
    FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Owners can insert employees" ON public.employees
    FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Owners can update employees" ON public.employees
    FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Owners can delete employees" ON public.employees
    FOR DELETE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- ==========================================================
-- ✅ DONE.
-- ==========================================================
