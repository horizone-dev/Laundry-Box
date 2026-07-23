const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const appData = process.env.APPDATA;
const liveProdPath = path.join(appData, 'Laundry Box', 'laundry_pos.sqlite');
const auditCopyPath = path.join(__dirname, 'audit_copy_laundry_pos.sqlite');

fs.copyFileSync(liveProdPath, auditCopyPath);
console.log(`Copied live database to temporary audit file: ${auditCopyPath}`);

const db = new Database(auditCopyPath, { readonly: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);

function getCount(tableName, condition = '') {
  if (!tables.includes(tableName)) return 0;
  const query = `SELECT count(*) as c FROM ${tableName} ${condition}`;
  return db.prepare(query).get().c;
}

function getSum(tableName, columnName, condition = '') {
  if (!tables.includes(tableName)) return 0;
  const query = `SELECT SUM(${columnName}) as s FROM ${tableName} ${condition}`;
  const res = db.prepare(query).get();
  return res && res.s !== null ? res.s : 0;
}

console.log('--- TABLES ---', tables);
['customers', 'orders', 'payments', 'advance_allocations', 'account_transactions', 'payment_links', 'z_reports', 'settlements'].forEach(t => {
  if (tables.includes(t)) {
    const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
    console.log(`\nTable ${t} (${getCount(t)} rows):`, cols);
  } else {
    console.log(`\nTable ${t}: NOT FOUND`);
  }
});
