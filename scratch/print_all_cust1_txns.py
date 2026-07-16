import sqlite3
import os

db_path = os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', 'laundry-box', 'laundry_pos.sqlite')

try:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get customer balance
    cursor.execute("SELECT * FROM customers WHERE id = 'CUST-1'")
    cust = dict(cursor.fetchone())
    print("Customer DB Balance:", cust['balance'])

    # Get active & deleted orders
    cursor.execute("""
        SELECT * FROM (
          SELECT 
            id, customerId, totalAmount, paidAmount, dueAmount, 
            paymentStatus, status, paymentMethod, createdAt, 
            0 AS isDeleted, NULL AS refundStatus, NULL AS refundMethod, NULL AS returnedAt 
          FROM orders 

          UNION ALL

          SELECT 
            id, customerId, totalAmount, paidAmount, 0 AS dueAmount, 
            originalPaymentStatus AS paymentStatus, 'Deleted' AS status, originalPaymentMethod AS paymentMethod, deletedAt AS createdAt, 
            1 AS isDeleted, refundStatus, refundMethod, returnedAt 
          FROM deleted_orders 
        ) AS u
        WHERE u.customerId = 'CUST-1'
        ORDER BY u.createdAt ASC
    """)
    print("\n--- ORDERS ---")
    for r in cursor.fetchall():
        d = dict(r)
        print(f"Order {d['id']}: CreatedAt={d['createdAt']} Total={d['totalAmount']} Paid={d['paidAmount']} Status={d['status']} PaymentStatus={d['paymentStatus']} isDeleted={d['isDeleted']} refundStatus={d['refundStatus']} returnedAt={d['returnedAt']}")

    # Get payments
    cursor.execute("SELECT * FROM payments WHERE customerId = 'CUST-1' ORDER BY createdAt ASC")
    print("\n--- PAYMENTS ---")
    for r in cursor.fetchall():
        d = dict(r)
        print(f"Payment {d['id']}: CreatedAt={d['createdAt']} Amount={d['amount']} Method={d['method']} OrderId={d['orderId']}")

    # Get allocations
    cursor.execute("""
        SELECT a.* FROM advance_allocations a
        JOIN payments p ON a.paymentId = p.id
        WHERE p.customerId = 'CUST-1'
    """)
    print("\n--- ALLOCATIONS ---")
    for r in cursor.fetchall():
        d = dict(r)
        print(f"Alloc {d['id']}: PaymentId={d['paymentId']} OrderId={d['orderId']} AmountUsed={d['amountUsed']}")

    conn.close()
except Exception as e:
    print("Error:", e)
