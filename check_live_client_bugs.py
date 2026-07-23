import sqlite3
import os

appdata = os.environ['APPDATA']
prod_db_path = os.path.join(appdata, 'Laundry Box', 'laundry_pos.sqlite')

conn = sqlite3.connect(prod_db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

def fetch_all(q, p=()):
    cur.execute(q, p)
    return [dict(r) for r in cur.fetchall()]

print("=== CHECKING PRODUCTION LIVE CLIENT DATA ===")
customers = fetch_all("SELECT * FROM customers")
orders = fetch_all("SELECT * FROM orders")
payments = fetch_all("SELECT * FROM payments")
deleted_orders = fetch_all("SELECT * FROM deleted_orders")

print(f"Total Live Customers: {len(customers)}")
print(f"Total Live Orders: {len(orders)}")
print(f"Total Live Payments: {len(payments)}")

for c in customers:
    cid = c['id']
    cname = c['name']
    db_bal = c['balance']
    op_bal = c['openingBalance'] or 0.0
    
    c_orders = [o for o in orders if o['customerId'] == cid and o.get('status') != 'Cancelled']
    c_pmts = [p for p in payments if p['customerId'] == cid]
    
    sum_due = sum(o['dueAmount'] or 0 for o in c_orders)
    sum_unlinked_adv = sum(p['amount'] or 0 for p in c_pmts if (not p['orderId'] or p['orderId'] == '') and p['method'] not in ('System Auto', 'Discount', 'Refund Advance'))
    
    # Expected Real Balance Formula: Opening Balance + Total Order Due - Available Advance
    expected_bal = op_bal + sum_due - sum_unlinked_adv
    diff = db_bal - expected_bal
    
    print(f"\nCustomer: '{cname}' ({cid})")
    print(f"  Stored DB Balance: {db_bal:.3f}")
    print(f"  Calculated Expected Balance: {expected_bal:.3f}")
    print(f"  Difference (Bug/Mismatch): {diff:.3f}")
    if abs(diff) > 0.005:
        print(f"  ⚠️ MISMATCH DETECTED FOR LIVE CUSTOMER '{cname}'!")

conn.close()
