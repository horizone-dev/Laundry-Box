import sqlite3
import os
import shutil
import json

appdata = os.environ['APPDATA']
prod_db_path = os.path.join(appdata, 'Laundry Box', 'laundry_pos.sqlite')
audit_db_path = os.path.join(os.getcwd(), 'audit_laundry_pos.sqlite')

shutil.copyfile(prod_db_path, audit_db_path)

conn = sqlite3.connect(audit_db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

def fetch_all(query, params=()):
    cur.execute(query, params)
    return [dict(r) for r in cur.fetchall()]

def fetch_one(query, params=()):
    cur.execute(query, params)
    r = cur.fetchone()
    return dict(r) if r else None

print("=== ALL TABLES IN DB ===")
cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
all_tables = [r['name'] for r in cur.fetchall()]
print(all_tables)

print("\n=== PRAGMA user_version ===")
cur.execute("PRAGMA user_version;")
print(cur.fetchone()[0])

print("\n=== CUSTOMERS ===")
customers = fetch_all("SELECT * FROM customers")
for c in customers:
    print(dict(c))

print("\n=== ORDERS ===")
orders = fetch_all("SELECT id, billNumber, customerId, status, totalAmount, paidAmount, dueAmount, paymentStatus, createdAt, paymentBreakdown FROM orders")
for o in orders:
    print(dict(o))

print("\n=== PAYMENTS ===")
payments = fetch_all("SELECT * FROM payments")
for p in payments:
    print(dict(p))

print("\n=== ADVANCE ALLOCATIONS ===")
allocs = fetch_all("SELECT * FROM advance_allocations")
print("Count:", len(allocs))
for a in allocs:
    print(dict(a))

print("\n=== ACCOUNT TRANSACTIONS ===")
txs = fetch_all("SELECT * FROM account_transactions")
for t in txs:
    print(dict(t))

print("\n=== DELETED ORDERS ===")
del_orders = fetch_all("SELECT * FROM deleted_orders")
print("Count:", len(del_orders))
for d in del_orders:
    print(dict(d))

print("\n=== CREDIT OVERRIDE LOGS ===")
logs = fetch_all("SELECT * FROM credit_override_logs")
print("Count:", len(logs))
for l in logs:
    print(dict(l))

conn.close()
