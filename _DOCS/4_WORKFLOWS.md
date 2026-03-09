# 4_WORKFLOWS.md — دورات حياة العمليات الرئيسية في المنظومة

> هذا الملف يوثّق بالتفصيل الكامل كيف تسير العمليات داخل النظام، وما يحدث خلف الكواليس في كل خطوة.

---

## 1. دورة حياة الطلبية الكاملة

### المراحل والحالات

```
PENDING → PROCESSING → WITH_COURIER / WITH_PARTNER → DELIVERED
                                                    → PENDING_RETURN → RETURN_CONFIRMED
       → CANCELLED (في أي مرحلة مبكرة)
```

### تفصيل كل حالة وتأثيرها

| الحالة             | المعنى                       | تأثير على المخزون                 | تأثير على الخزينة                                                                                           |
| ------------------ | ---------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pending`          | طلبية جديدة — لم تُجهَّز بعد | **خصم فوري** للمخزون عند الإنشاء  | بدون تأثير                                                                                                  |
| `processing`       | قيد التجهيز والتعبئة         | بدون تأثير (خُصم مسبقاً)          | بدون تأثير                                                                                                  |
| `with_courier`     | سُلِّمت لشركة توصيل          | بدون تأثير                        | بدون تأثير                                                                                                  |
| `with_partner`     | مع مندوب شريك                | بدون تأثير                        | بدون تأثير                                                                                                  |
| `delivered`        | تم التسليم للزبون ✅         | بدون تأثير                        | **يُضاف إيراد** المبيعات (`sale`) لحساب `cash_in_hand` تلقائياً — للطلبيات الداخلية فقط (`internal/pickup`) |
| `cancelled`        | ملغاة                        | **يُعاد المخزون** للمنتجات كاملاً | إذا كانت مسلَّمة: **يُسحب المبلغ** من الخزينة (عكس العملية)                                                 |
| `pending_return`   | طلب إرجاع معلق               | بدون تأثير                        | بدون تأثير                                                                                                  |
| `return_confirmed` | تأكيد استلام المرتجع         | **يُعاد المخزون**                 | **يُسحب المبلغ** من الخزينة (إذا داخلي)                                                                     |

### قواعد الانتقال بين الحالات

```typescript
// الانتقالات المسموح بها (NEXT_STATUSES في orders/page.tsx)
pending      → processing, cancelled
processing   → with_courier, cancelled
with_courier → delivered, pending_return
with_partner → delivered, pending_return
pending_return → return_confirmed
// delivered و cancelled: لا انتقال منهما (نهائيتان)
```

### دالة إنشاء الطلبية (`addOrder` في store.ts)

1. **التحقق من المخزون:** لكل منتج في الطلبية — هل يوجد مخزون كافٍ؟ (للمتغيرات: يتحقق من المقاس المحدد)
2. **خصم المخزون:** فوراً عند الإنشاء — يُنقص `product.quantity` و `variant.quantity`
3. **بيانات الزبون:** تُحدَّث تلقائياً في جدول `customers` (إضافة أو تحديث)
4. **إشعار:** يُولَّد إشعار داخلي "طلبية جديدة"
5. **تنبيه المخزون:** إذا وصل المخزون للحد الأدنى بعد الخصم، يُولَّد إشعار تحذيري

---

## 2. دورة المخزون

### أ. إضافة منتج جديد

```
المستخدم يملأ نموذج AddProductSlideOver
  → preSaveCheck() — تحقق من البيانات
  → showConfirm = true (نافذة تأكيد تعرض التكلفة والرصيد المتبقي)
  → المستخدم يضغط "تأكيد"
  → handleSave()
    → addProduct(p) في store.ts
      → التحقق: هل totalCost ≤ رصيد cash_in_hand؟
      → إذا لا: إيقاف العملية (warning في console)
      → إذا نعم: إضافة المنتج + خصم التكلفة من الخزينة + تسجيل حركة expense
```

**حساب التكلفة:**

```
totalQty = variants.reduce(sum) أو product.quantity (للبسيط)
totalCost = totalQty × costPrice
```

**تسجيل الحركة المالية:**

```
description: "توريد بضاعة: [اسم المنتج] × [الكمية] قطعة بسعر [costPrice] د.ل"
transactionType: "expense"
amount: -totalCost
```

### ب. إضافة كميات لمنتج موجود (WAC)

```
المستخدم يختار منتج، يُدخل الكمية وسعر الشراء (اختياري)
  → handleAddQty() في inventory/page.tsx
    → حساب WAC:
    newCostPrice = ((oldQty × oldCost) + (addedQty × purchasePrice)) / (oldQty + addedQty)
    costPrice = Math.round(newCostPrice)
    → updateProduct(id, { quantity, costPrice, variants? })
      → في store.ts: التحقق من الرصيد (addedCost ≤ cashBalance)
      → خصم التكلفة من الخزينة + تسجيل حركة
      → التنبيهات: إذا ارتفع المخزون فوق الحد الأدنى — بدون تنبيه
```

**قاعدة WAC الإجبارية:**

- نستخدم `Math.round()` فقط — ممنوع `.toFixed(2)` أو تخزين كسور
- الـ WAC يُحسب أيضاً في Store حين يُبنى وصف الحركة المالية

### ج. حذف منتج (Soft Delete)

```
deleteProduct(id)
  → التحقق: هل يوجد طلبية نشطة على هذا المنتج؟
  → إذا نعم: رفض الحذف مع رسالة خطأ
  → إذا لا: product.isActive = false (لا يُحذف نهائياً من الـ Store)
```

الإظهار في المخزون: `filter(p => p.isActive)` — المنتجات المحذوفة لا تظهر.

### د. حالات المنتج (متاح / ينفذ / نفذ)

```typescript
// من statusColors.ts
getStockStatus(quantity, minQuantity):
  quantity <= 0       → "نفد"   (أحمر)
  quantity <= min     → "ينفذ"  (أصفر)
  quantity > min      → "متاح"  (أخضر)
```

---

## 3. دورة الخزينة

### مصادر الدخل (زيادة الرصيد)

| المصدر           | النوع (`transactionType`) | متى يحدث                                         |
| ---------------- | ------------------------- | ------------------------------------------------ |
| بيع داخلي مسلَّم | `sale`                    | عند تحويل الطلبية إلى `delivered` (داخلي/استلام) |
| تسوية شركة توصيل | `courier_settlement`      | يدوياً من وحدة التوصيل                           |
| ضخ مال يدوي      | `income`                  | يدوياً من صفحة الخزينة                           |
| إلغاء إرجاع      | (عكس expense)             | تلقائياً عند cancel طلبية مسلّمة                 |

### مصادر الخروج (خصم من الرصيد)

| المصدر            | النوع (`transactionType`) | متى يحدث                              |
| ----------------- | ------------------------- | ------------------------------------- |
| توريد بضاعة جديدة | `expense`                 | عند addProduct                        |
| تعزيز مخزون       | `expense`                 | عند updateProduct بزيادة كمية         |
| رواتب الموظفين    | `expense`                 | عند issuePayroll                      |
| سلفة موظف         | `expense`                 | عند recordEmployeeFinancial (advance) |
| سحب شريك          | `partner_withdrawal`      | عند withdrawPartnerFunds              |
| مصاريف يدوية      | `expense`                 | يدوياً من صفحة الخزينة                |

### كيف يتحدث الرصيد فورياً

```typescript
// في كل عملية في store.ts:
set((s) => {
  const newTreasury = s.treasury.map(acc =>
    acc.id === targetAccountId
      ? { ...acc, balance: acc.balance ± amount }
      : acc
  );
  const newTransactions = [newTx, ...s.transactions];
  return { treasury: newTreasury, transactions: newTransactions };
});
// Zustand + persist → يُحفظ في localStorage تلقائياً
```

### حسابات الخزينة

```
الخزينة الرئيسية (cash_in_hand):  رصيد نقدي متاح للاستخدام الفوري
أموال قيد التحصيل (with_courier): أموال عند شركات التوصيل تنتظر التسوية
إجمالي الأصول = كل الحسابات مجتمعة
```

---

## 4. دورة الموارد البشرية

### إضافة موظف جديد

```
HR → إضافة موظف
  → addEmployee(p) في store.ts
  → إذا hasSystemAccess:
    addUser({...}) → ينشئ TenantUser تلقائياً
    الباسورد الافتراضي: 123456 (أو ما يختاره المدير)
```

### قوالب الصلاحيات للموظفين

| القالب                  | الصلاحيات Aut                       |
| ----------------------- | ----------------------------------- |
| `sales` (موظف مبيعات)   | الطلبيات كاملاً + رؤية المخزون فقط  |
| `warehouse` (أمين مخزن) | المخزون كاملاً + تعديل حالة الطلبية |
| `custom` (مخصص)         | صلاحيات يختارها المدير يدوياً       |

### دورة الراتب الشهري

```
1. recordEmployeeFinancial(advance) → سلفة فورية من الخزينة، tuأضاف للـ advanceBalance
2. recordEmployeeFinancial(bonus)   → مكافأة معلقة في allowanceBalance
3. recordEmployeeFinancial(deduction) → خصم معلق في deductionBalance

4. issuePayroll(month, details[]) → مسير الرواتب:
   netAmount = salary - advanceDeduction + allowanceApplied - deductionApplied - absentDeduction
   → خصم الإجمالي من cash_in_hand
   → تصفير advanceBalance, allowanceBalance, deductionBalance للموظفين
   → تسجيل حركة expense في الخزينة
   → تحديث lastPayrollDate لكل موظف
```

**الحماية:** إذا رصيد الخزينة < إجمالي الرواتب → `issuePayroll` يرفض ويُعيد `{ success: false }`.

---

## 5. قواعد الصلاحيات بالتفصيل

### OWNER (المالك)

✅ جميع الصلاحيات على كل الوحدات دون استثناء:

- رؤية أسعار التكلفة والربح
- حذف المنتجات والموظفين والشركاء
- الوصول لصفحات الخزينة، الشركاء، HR، الإعدادات
- إصدار الرواتب وتوزيع الأرباح
- إدارة المستخدمين والصلاحيات

### EMPLOYEE (الموظف)

| الوحدة    | يستطيع                                                    | لا يستطيع                    |
| --------- | --------------------------------------------------------- | ---------------------------- |
| المخزون   | رؤية المنتجات، إضافة/تعديل (إذا أُعطيت صلاحية)            | رؤية أسعار التكلفة، حذف      |
| الطلبيات  | إنشاء طلبية، تعديل حالتها، رؤية كل الطلبيات (إذا viewAll) | حذف الطلبيات                 |
| التوصيل   | رؤية وإضافة شحنات                                         | إدارة الشركات، رؤية التسويات |
| الخزينة   | ❌ لا وصول                                                | كل شيء                       |
| الشركاء   | ❌ لا وصول عام                                            | كل شيء                       |
| HR        | رؤية ملفه الشخصي فقط (`viewOwn`)                          | بيانات الآخرين               |
| الإعدادات | ❌ لا وصول                                                | كل شيء                       |

### PARTNER (الشريك)

| الوحدة             | يستطيع                            | لا يستطيع                |
| ------------------ | --------------------------------- | ------------------------ |
| الشركاء            | رؤية ملفه ومحفظته (`viewOwn`)     | بيانات الشركاء الآخرين   |
| التحليلات          | رؤية إحصائيات المتجر (إذا أُعطيت) | التقارير المالية الكاملة |
| HR                 | رؤية ملفه فقط                     | بيانات الموظفين          |
| الخزينة            | ❌ لا وصول                        | كل شيء                   |
| المخزون / الطلبيات | حسب إعداد الصلاحيات               | —                        |
| الإعدادات          | ❌ لا وصول                        | كل شيء                   |

### آلية التحقق من الصلاحيات في الـ UI

```typescript
// في كل صفحة:
const isOwner = user?.role === "owner";
const canView = isOwner || user?.permissions?.module?.view;
const canAdd = isOwner || user?.permissions?.module?.add;
// ...الخ

// في الـ Middleware (middleware.ts):
// يحجب المسارات المحمية بناءً على Cookie erp_auth
```

**نهاية الملف**
