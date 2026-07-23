import sqlite3, os

p = os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', 'laundry-box', 'laundry_pos.sqlite')
conn = sqlite3.connect(p)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

orders = [dict(o) for o in cur.execute("SELECT * FROM orders WHERE customerId = 'CUST-412'").fetchall()]
del_orders = [dict(o) for o in cur.execute("SELECT * FROM deleted_orders WHERE customerId = 'CUST-412'").fetchall()]
payments = [dict(pmt) for pmt in cur.execute("SELECT * FROM payments WHERE customerId = 'CUST-412'").fetchall()]

rows = []

# Process active payments
for p in payments:
    if p['method'] not in ('Refund Advance', 'Advance', 'System Auto'):
        rows.append({
            'date': p['createdAt'],
            'type': 'payment',
            'ref': p['paymentReference'] or p['id'],
            'credit': 0 if p['method'] == 'Discount' else (p['amount'] or 0),
            'debit': 0,
            'desc': f"Payment - {p['method']}"
        })

# Process deleted orders
for o in del_orders:
    # 1. Order charge
    rows.append({
        'date': o['createdAt'],
        'type': 'order',
        'ref': o['id'],
        'credit': 0,
        'debit': o['totalAmount'] or 0,
        'desc': f"Order {o['id']} (Later Deleted)"
    })
    # 2. Deletion reversal
    rows.append({
        'date': o['deletedAt'],
        'type': 'deleted_order',
        'ref': o['id'],
        'credit': o['totalAmount'] or 0,
        'debit': 0,
        'desc': f"Order Deleted {o['id']}"
    })
    
    # 3. Payments
    import json
    try:
        parsed = json.loads(o['payments'])
    except:
        parsed = []
        
    valid_parsed = [p for p in parsed if p['method'] not in ('Refund Advance', 'Advance', 'System Auto')]
    
    for p in valid_parsed:
        rows.append({
            'date': p.get('createdAt') or o['createdAt'],
            'type': 'payment',
            'ref': p.get('id') or o['id'],
            'credit': 0 if p['method'] == 'Discount' else (p['amount'] or 0),
            'debit': 0,
            'desc': f"Payment - {p['method']}"
        })
        
    # Fallback
    deleted_pay_sum = sum(p['amount'] or 0 for p in valid_parsed if p['method'] != 'Discount')
    initial_deleted_pay = (o['paidAmount'] or 0) - deleted_pay_sum
    if initial_deleted_pay > 0.01:
        # Check if the fallback is advance or not
        if o['originalPaymentMethod'] not in ('Advance', 'Refund Advance', 'System Auto'):
            rows.append({
                'date': o['createdAt'],
                'type': 'payment',
                'ref': o['id'],
                'credit': initial_deleted_pay,
                'debit': 0,
                'desc': f"Payment - {o['originalPaymentMethod']}"
            })
            
    # Converted to advance
    if o['refundStatus'] == 'Converted to Advance' and (o['paidAmount'] or 0) > 0:
        rows.append({
            'date': o['deletedAt'],
            'type': 'payment',
            'ref': f"ADV-CONV-{o['id']}",
            'credit': 0, # Should be 0 to prevent double-counting!
            'debit': 0,
            'desc': f"Converted to Advance (Amount: {o['paidAmount']})"
        })

# Sort rows by date
rows.sort(key=lambda x: x['date'])

balance = -599.0 # initial balance is opening balance = -599.0 (since openingBalance is -599.0)
print(f"Start balance: {balance}")
for r in rows:
    balance += r['debit'] - r['credit']
    print(f"Date: {r['date']} | Desc: {r['desc']} | Debit: {r['debit']} | Credit: {r['credit']} | Running Balance: {balance}")
