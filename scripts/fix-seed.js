const fs = require('fs');
const path = require('path');

const seedPath = path.join('c:', 'Users', 'abdo', 'Documents', 'GitHub', 'libya-erp-saas', 'src', 'core', 'db', 'seed.ts');
let content = fs.readFileSync(seedPath, 'utf8');

// 2. Fix SEED_PRODUCTS
let itemCodeCounter = 1000;
content = content.replace(/(costPrice:\s*\d+,\s*sellingPrice:\s*\d+,\s*quantity:\s*\d+,\s*minQuantity:\s*\d+,\s*isActive:\s*true)(\s*\})/g, () => {
  return `$1, itemCode: '${itemCodeCounter++}', productType: 'simple' }`;
});

// 3. Fix SEED_ORDERS
content = content.replace(/status:\s*'confirmed'/g, "status: 'processing'");
content = content.replace(/status:\s*s/g, "status: s === 'confirmed' ? 'processing' : s");
content = content.replace(/(paymentStatus:\s*ps,\s*items,)/g, "$1 priceIncludesDelivery: false, source: 'direct',");

// 4. Fix SEED_DEBTS
content = content.replace(/debtType:\s*'external',\s*debtCategory:\s*'supplier',\s*debtorName:\s*SEED_TENANTS\[idx\]\.name,\s*creditorName:\s*'([^']+)'/g, "debtType: 'external', debtCategory: 'supplier', linkedEntityName: '$1', linkedEntityType: 'supplier', linkedEntityId: 'dummy-supp'");
content = content.replace(/debtType:\s*'external',\s*debtCategory:\s*'customer',\s*debtorName:\s*'([^']+)',\s*creditorName:\s*SEED_TENANTS\[idx\]\.name/g, "debtType: 'external', debtCategory: 'customer', linkedEntityName: '$1', linkedEntityType: 'customer', linkedEntityId: 'dummy-cust'");
content = content.replace(/debtType:\s*'internal',\s*debtCategory:\s*'employee_advance',\s*debtorName:\s*`([^`]+)`,\s*creditorName:\s*SEED_TENANTS\[idx\]\.name/g, "debtType: 'internal', debtCategory: 'employee_advance', linkedEntityName: `$1`, linkedEntityType: 'employee', linkedEntityId: 'dummy-emp'");
// Add paymentHistory to debts
content = content.replace(/(dueDate:\s*'[^']+',\s*status:\s*'[^']+',\s*description:\s*'[^']+',\s*createdAt:\s*'[^']+')(\s*\})/g, "paymentHistory: [], $1$2");

// 5. Fix SEED_EMPLOYEES
content = content.replace(/role:\s*'([^']+)'/g, "jobTitle: '$1', status: 'active', hasSystemAccess: true, employmentType: 'full_time'");
content = content.replace(/role:\s*`([^`]+)`/g, "jobTitle: `$1`, status: 'active', hasSystemAccess: true, employmentType: 'full_time'");

// 6. Fix SEED_PARTNERS
content = content.replace(/(isActive:\s*true)(,\s*joinedAt)/g, "$1, partnerRole: 'active_partner'$2");

// 7. Fix SEED_TRANSACTIONS
content = content.replace(/transactionType:\s*'capital_injection'/g, "transactionType: 'income'");
content = content.replace(/transactionType:\s*'order_collection'/g, "transactionType: 'income'");
content = content.replace(/transactionType:\s*'profit_distribution'/g, "transactionType: 'partner_withdrawal'");
// Add transactionDate
content = content.replace(/(amount:\s*[^,]+,\s*description:\s*[^,]+,\s*createdAt:\s*('[^']+'|new Date\(\)\.toISOString\(\)))/g, "$1, transactionDate: $2");

fs.writeFileSync(seedPath, content, 'utf8');
console.log('seed.ts has been updated successfully.');
