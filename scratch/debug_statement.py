import sqlite3
import os
import json

db_path = os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', 'laundry-box', 'laundry_pos.sqlite')
log_path = r"C:\Users\Orbix Soft. Solution\.gemini\antigravity-ide\brain\9394e0d2-96a9-4c92-9d06-63315422ae90\scratch\ledger_log.txt"

def normalize_date(d_str):
    if not d_str:
        return "1970-01-01T00:00:00"
    d = d_str.replace(' ', 'T')
    if '+' in d:
        d = d.split('+')[0]
    if 'Z' in d:
        d = d.replace('Z', '')
    return d

try:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get customer info
    cursor.execute("SELECT * FROM customers WHERE id = 'CUST-1'")
    cust = dict(cursor.fetchone())
    db_balance = cust['balance']

    # Get orders
    cursor.execute("""
        SELECT * FROM (
          SELECT 
            id, customerId, totalAmount, paidAmount, dueAmount, 
            paymentStatus, status, paymentMethod, items, createdAt, 
            0 AS isDeleted, NULL AS refundStatus, NULL AS refundMethod, NULL AS returnedAt, NULL AS payments 
          FROM orders 

          UNION ALL

          SELECT 
            id, customerId, totalAmount, paidAmount, 0 AS dueAmount, 
            originalPaymentStatus AS paymentStatus, 'Deleted' AS status, originalPaymentMethod AS paymentMethod, items, deletedAt AS createdAt, 
            1 AS isDeleted, refundStatus, refundMethod, returnedAt, payments 
          FROM deleted_orders 
        ) AS u
        WHERE u.customerId = 'CUST-1'
    """)
    orders = [dict(row) for row in cursor.fetchall()]

    # Get payments
    cursor.execute("SELECT * FROM payments WHERE customerId = 'CUST-1'")
    payments = [dict(row) for row in cursor.fetchall()]

    # Get allocations
    cursor.execute("""
        SELECT a.* FROM advance_allocations a
        JOIN payments p ON a.paymentId = p.id
        WHERE p.customerId = 'CUST-1'
    """)
    allocations = [dict(row) for row in cursor.fetchall()]

    conn.close()

    # Build ledger rows
    rows = []
    for o in orders:
        cleanRef = f"#{o['id']}"
        if o['isDeleted']:
            rows.append({
                'date': o['createdAt'],
                'type': 'deleted_order',
                'ref': cleanRef,
                'debit': 0,
                'credit': 0,
            })
            if o['refundStatus'] == 'Returned' and o['paidAmount'] > 0:
                rows.append({
                    'date': o['returnedAt'] or o['createdAt'],
                    'type': 'refund',
                    'ref': f"REF-{o['id']}",
                    'debit': o['paidAmount'],
                    'credit': 0,
                })
            
            parsed_pays = []
            if o['payments']:
                try:
                    parsed_pays = json.loads(o['payments']) if isinstance(o['payments'], str) else o['payments']
                except Exception:
                    pass
            deletedPaySum = sum(p.get('amount') or 0 for p in parsed_pays) if isinstance(parsed_pays, list) else 0
            initialDeletedPay = (o['paidAmount'] or 0) - deletedPaySum
            
            if isinstance(parsed_pays, list):
                for p in parsed_pays:
                    rows.append({
                        'date': p.get('createdAt') or o['createdAt'],
                        'type': 'payment',
                        'ref': p.get('id') or f"PAY-DEL-{o['id']}",
                        'debit': 0,
                        'credit': p.get('amount') or 0,
                    })
            if initialDeletedPay > 0.01:
                rows.append({
                    'date': o['createdAt'],
                    'type': 'payment',
                    'ref': cleanRef,
                    'debit': 0,
                    'credit': initialDeletedPay,
                })
        else:
            rows.append({
                'date': o['createdAt'],
                'type': 'order',
                'ref': cleanRef,
                'debit': o['totalAmount'],
                'credit': 0,
            })

    paymentsFromTable = []
    for p in payments:
        paymentsFromTable.append({
            'date': p['createdAt'],
            'type': 'payment',
            'ref': p['id'],
            'debit': 0,
            'credit': p['amount'],
            'orderId': p['orderId']
        })

    tablePaymentsByOrder = {}
    for p in paymentsFromTable:
        if p['orderId']:
            tablePaymentsByOrder[p['orderId']] = tablePaymentsByOrder.get(p['orderId'], 0) + p['credit']

    initialPaymentsFromOrders = []
    for o in orders:
        if o['isDeleted']:
            continue
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
                'debit': 0,
                'credit': initialPay,
            })

    for p in paymentsFromTable:
        rows.append(p)
    for p in initialPaymentsFromOrders:
        rows.append(p)

    # Sort chronologically
    rows.sort(key=lambda r: (normalize_date(r['date']), 0 if r['debit'] > 0 else 1))

    with open(log_path, 'w', encoding='utf-8') as f:
        f.write(f"Customer DB Balance: {db_balance}\n")
        f.write(f"Total Rows: {len(rows)}\n\n")
        f.write("--- Ledger Calculation Log ---\n")
        balance = 0.0
        for idx, r in enumerate(rows):
            prev_bal = balance
            # Credit increases balance, Debit decreases balance
            balance += r['credit'] - r['debit']
            
            bal_str = f"{abs(balance):.2f} Adv" if balance > 0 else f"{abs(balance):.2f} Due" if balance < 0 else "0.00"
            prev_str = f"{abs(prev_bal):.2f} Adv" if prev_bal > 0 else f"{abs(prev_bal):.2f} Due" if prev_bal < 0 else "0.00"
            
            f.write(f"Row {idx+1:2d} | Date: {r['date']} | Ref: {r['ref']:12s} | Type: {r['type']:13s} | Prev: {prev_str:10s} | Credit: {r['credit']:7.2f} | Debit: {r['debit']:7.2f} | New: {bal_str}\n")
            
        f.write(f"\nFinal calculated ledger balance: {balance}\n")
        f.write(f"Customer database balance: {-db_balance}\n")
        
    print("Log written successfully to", log_path)
    
except Exception as e:
    print("Error:", e)
