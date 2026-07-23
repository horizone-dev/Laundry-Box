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

# 1. DATABASE METADATA & COUNTS
cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [r['name'] for r in cur.fetchall()]

cur.execute("PRAGMA user_version;")
user_version = cur.fetchone()[0]

num_customers = len(fetch_all("SELECT * FROM customers"))
num_orders = len(fetch_all("SELECT * FROM orders"))
num_deleted_orders = len(fetch_all("SELECT * FROM deleted_orders"))
num_payments = len(fetch_all("SELECT * FROM payments"))
num_allocations = len(fetch_all("SELECT * FROM advance_allocations"))
num_transactions = len(fetch_all("SELECT * FROM account_transactions"))
num_payment_links = 0 # Table doesn't exist in schema

print(f"=== DB METADATA ===")
print(f"Prod DB Path: {prod_db_path}")
print(f"Audit DB Copy Path: {audit_db_path}")
print(f"User Version / Schema Version: {user_version}")
print(f"Customers: {num_customers}, Orders: {num_orders}, Deleted Orders: {num_deleted_orders}")
print(f"Payments: {num_payments}, Allocations: {num_allocations}, Txns: {num_transactions}, Links: {num_payment_links}")

# 2. FINANCIAL SNAPSHOT
active_orders = fetch_all("SELECT * FROM orders")
payments = fetch_all("SELECT * FROM payments")
customers = fetch_all("SELECT * FROM customers")
allocations = fetch_all("SELECT * FROM advance_allocations")

total_order_value = sum(o['totalAmount'] or 0 for o in active_orders)
total_recorded_order_paid = sum(o['paidAmount'] or 0 for o in active_orders)
total_recorded_order_due = sum(o['dueAmount'] or 0 for o in active_orders)
total_payment_ledger = sum(p['amount'] or 0 for p in payments)
total_unlinked_payments = sum(p['amount'] or 0 for p in payments if not p['orderId'])
total_advance_allocated = sum(a['amountUsed'] or 0 for a in allocations)
total_customer_balance = sum(c['balance'] or 0 for c in customers)
total_opening_balance = sum(c['openingBalance'] or 0 for c in customers)

print(f"\n=== FINANCIAL SNAPSHOT ===")
print(f"Total Order Value: {total_order_value:.3f}")
print(f"Total Recorded Order Paid: {total_recorded_order_paid:.3f}")
print(f"Total Recorded Order Due: {total_recorded_order_due:.3f}")
print(f"Total Payment Ledger: {total_payment_ledger:.3f}")
print(f"Total Unlinked Payments: {total_unlinked_payments:.3f}")
print(f"Total Advance Allocated: {total_advance_allocated:.3f}")
print(f"Total Customer Balance: {total_customer_balance:.3f}")
print(f"Total Opening Balance: {total_opening_balance:.3f}")

# 3. CUSTOMER RECONCILIATION
print(f"\n=== CUSTOMER RECONCILIATION ===")
for c in customers:
    cid = c['id']
    cname = c['name']
    op_bal = c['openingBalance'] or 0.0
    db_bal = c['balance'] or 0.0
    
    cust_orders = [o for o in active_orders if o['customerId'] == cid]
    cust_payments = [p for p in payments if p['customerId'] == cid]
    cust_allocs = [a for a in allocations if a.get('customerId') == cid]
    
    tot_ord_amt = sum(o['totalAmount'] or 0 for o in cust_orders)
    tot_ord_paid_stored = sum(o['paidAmount'] or 0 for o in cust_orders)
    tot_ord_due_stored = sum(o['dueAmount'] or 0 for o in cust_orders)
    
    tot_pmts_direct = sum(p['amount'] or 0 for p in cust_payments if p['orderId'])
    tot_pmts_unlinked = sum(p['amount'] or 0 for p in cust_payments if not p['orderId'])
    
    # Calculate Expected Balance:
    # Formula options in laundry app context:
    # Balance = OpeningBalance + TotalOrderAmount - TotalPayments
    # OR Net Due = SUM(Order Due) + OpeningBalance - Advance
    calc_bal = op_bal + tot_ord_due_stored
    
    diff = db_bal - calc_bal
    
    print(f"\nCustomer: {cname} ({cid})")
    print(f"  DB Balance: {db_bal:.3f}, Opening Balance: {op_bal:.3f}")
    print(f"  Orders: Total={tot_ord_amt:.3f}, PaidStored={tot_ord_paid_stored:.3f}, DueStored={tot_ord_due_stored:.3f}")
    print(f"  Payments: Direct={tot_pmts_direct:.3f}, Unlinked={tot_pmts_unlinked:.3f}, TotalPayments={tot_pmts_direct + tot_pmts_unlinked:.3f}")

# 4. ORDER MISMATCHES
print(f"\n=== ORDER MISMATCHES ===")
for o in active_orders:
    oid = o['id']
    tot = o['totalAmount'] or 0.0
    paid_st = o['paidAmount'] or 0.0
    due_st = o['dueAmount'] or 0.0
    
    linked_pmts = sum(p['amount'] or 0 for p in payments if p['orderId'] == oid)
    calc_due = tot - linked_pmts
    
    diff_paid = paid_st - linked_pmts
    diff_math = (paid_st + due_st) - tot
    
    flags = []
    if paid_st > tot: flags.append("PAID > TOTAL")
    if due_st < 0: flags.append("DUE < 0")
    if abs(diff_math) > 0.001: flags.append("PAID + DUE != TOTAL")
    if abs(diff_paid) > 0.001: flags.append("PAYMENT LEDGER != ORDER PAID")
    
    if flags:
        print(f"Order {oid} ({o['billNumber']}): Tot={tot:.3f}, StoredPaid={paid_st:.3f}, PmtLedger={linked_pmts:.3f}, StoredDue={due_st:.3f}, Flags={flags}")

conn.close()
