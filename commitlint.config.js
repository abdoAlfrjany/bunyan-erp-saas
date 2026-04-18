module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // ميزة جديدة
        'fix',      // إصلاح خطأ
        'docs',     // تحديث التوثيق
        'style',    // تنسيق فقط
        'refactor', // إعادة هيكلة
        'test',     // إضافة اختبارات
        'chore',    // صيانة
        'ci',       // تحديث CI/CD
        'perf',     // تحسين الأداء
        'security', // تحديث أمني
      ],
    ],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
  },
}
