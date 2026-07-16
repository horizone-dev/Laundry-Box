import sqlite3
import os
import json

db_path = os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', 'laundry-box', 'laundry_pos.sqlite')

def get_ledger():
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get customer balance
    cursor.execute("SELECT * FROM customers WHERE id = 'CUST-1'")
    cust = dict(cursor.fetchone())

    # Get active & deleted orders
    cursor.execute("""
        SELECT * FROM (
          SELECT 
            id, shopId, billNumber, customerId, totalAmount, paidAmount, dueAmount, 
            paymentStatus, status, paymentMethod, items, createdAt, updatedAt, 
            0 AS isDeleted, NULL AS refundStatus, NULL AS refundMethod, NULL AS returnedAt, NULL AS payments 
          FROM orders 

          UNION ALL

          SELECT 
            id, shopId, billNumber, customerId, totalAmount, paidAmount, 0 AS dueAmount, 
            originalPaymentStatus AS paymentStatus, 'Deleted' AS status, originalPaymentMethod AS paymentMethod, items, deletedAt AS createdAt, deletedAt AS updatedAt, 
            1 AS isDeleted, refundStatus, refundMethod, returnedAt, payments 
          FROM deleted_orders 
        ) AS u
        WHERE u.customerId = 'CUST-1'
        ORDER BY u.createdAt ASC
    """)
    orders = [dict(row) for row in cursor.fetchall()]

    # Get payments
    cursor.execute("SELECT * FROM payments WHERE customerId = 'CUST-1' ORDER BY createdAt ASC")
    payments = [dict(row) for row in cursor.fetchall()]

    # Get allocations
    cursor.execute("""
        SELECT a.* FROM advance_allocations a
        JOIN payments p ON a.paymentId = p.id
        WHERE p.customerId = 'CUST-1'
    """)
    allocations = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return cust, orders, payments, allocations

cust, orders, payments, allocations = get_ledger()

print(f"Customer balance in DB: {cust['balance']}")

# Calculate actual running ledger rows:
rows = []

for o in orders:
    cleanRef = f"#{o['id']}"
    if o['isDeleted']:
        rows.append({
            'date': o['createdAt'],
            'type': 'deleted_order',
            'ref': cleanRef,
            'description': f"Deleted Bill {cleanRef}",
            'debit': 0,
            'credit': 0,
        })
        if o['refundStatus'] == 'Returned' and o['paidAmount'] > 0:
            rows.append({
                'date': o['returnedAt'] or o['createdAt'],
                'type': 'refund',
                'ref': f"REF-{o['id']}",
                'description': f"Refund - {o['refundMethod'] or 'Cash'}",
                'debit': o['paidAmount'],
                'credit': 0,
            })
        # Add original payments parsed from JSON
        parsed_pays = []
        if o['payments']:
            try:
                parsed_pays = json.loads(o['payments']) if isinstance(o['payments'], str) else o['payments']
            except Exception as e:
                pass
        
        # Calculate sum of parsed payments
        deletedPaySum = sum(p.get('amount') or 0 for p in parsed_pays) if isinstance(parsed_pays, list) else 0
        initialDeletedPay = (o['paidAmount'] or 0) - deletedPaySum
        
        if isinstance(parsed_pays, list):
            for p in parsed_pays:
                rows.append({
                    'date': p.get('createdAt') or o['createdAt'],
                    'type': 'payment',
                    'ref': p.get('id') or f"PAY-DEL-{o['id']}",
                    'description': f"Payment - {p.get('method') or 'Cash'}",
                    'debit': 0,
                    'credit': p.get('amount') or 0,
                })
        
        if initialDeletedPay > 0.01:
            rows.append({
                'date': o['createdAt'],
                'type': 'payment',
                'ref': cleanRef,
                'description': f"Payment - {o['paymentMethod'] or 'Cash'}",
                'debit': 0,
                'credit': initialDeletedPay,
            })
    else:
        # Active Order
        rows.append({
            'date': o['createdAt'],
            'type': 'order',
            'ref': cleanRef,
            'description': f"Order {o['id']}",
            'debit': o['totalAmount'],
            'credit': 0,
        })

# Map payments from table
paymentsFromTable = []
for p in payments:
    paymentsFromTable.append({
        'date': p['createdAt'],
        'type': 'payment',
        'ref': p['id'],
        'description': f"Payment - {p['method'] or 'Cash'}",
        'debit': 0,
        'credit': p['amount'],
        'orderId': p['orderId']
    })

tablePaymentsByOrder = {}
for p in paymentsFromTable:
    if p['orderId']:
        tablePaymentsByOrder[p['orderId']] = tablePaymentsByOrder.get(p['orderId'], 0) + p['credit']

# Capture initial payments made at order creation time that aren't in the payments table, subtracting advance allocations
initialPaymentsFromOrders = []
for o in orders:
    if o['isDeleted']:
        continue
    # Sum allocations for this order
    allocs = [a for a in allocations if a['orderId'] == o['id']]
    alloc_sum = sum(a['amountUsed'] for a in allocs)
    
    actual_payment_paid = (o['paidAmount'] or 0) - alloc_sum
    tablePaySum = tablePaymentsByOrder.get(o['id'], 0)
    initialPay = actual_payment_paid - tablePaySum
    
    if initialPay > 0.01:
        initialPaymentsFromOrders.append({
            'date': o['createdAt'],
            'type': 'payment',
            'ref': f"#{o['id']}",
            'description': f"Payment - {o['paymentMethod'] or 'Cash'}",
            'debit': 0,
            'credit': initialPay,
        })

for p in paymentsFromTable:
    rows.append(p)
for p in initialPaymentsFromOrders:
    rows.append(p)

def normalize_date(d_str):
    d = d_str.replace(' ', 'T')
    if '+' in d:
        d = d.split('+')[0]
    if 'Z' in d:
        d = d.replace('Z', '')
    return d

rows.sort(key=lambda r: (normalize_date(r['date']), 0 if r['debit'] > 0 else 1))

balance = 0
for idx, r in enumerate(rows):
    # runningBalance = runningBalance + Credit - Debit
    balance += r['credit'] - r['debit']
    r['runningBalance'] = balance
    
    bal_str = f"{abs(balance):.2f} Adv" if balance > 0 else f"{abs(balance):.2f} Due" if balance < 0 else "0.00"
    print(f"{idx+1:2d}. Date: {r['date']} | Ref: {r['ref']:12s} | Type: {r['type']:13s} | Debit: {r['debit']:7.2f} | Credit: {r['credit']:7.2f} | Bal: {bal_str}")

print(f"Final calculated ledger balance: {balance} (Adv: {balance > 0}, Due: {balance < 0})")
print(f"Compare to customer database balance (-runningBalance): {-balance}")
