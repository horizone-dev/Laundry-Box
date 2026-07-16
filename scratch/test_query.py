import sqlite3
import json
import traceback

def simulate_delete():
    conn = sqlite3.connect(r'C:\Users\Orbix Soft. Solution\AppData\Roaming\laundry-box\laundry_pos.sqlite')
    conn.row_factory = sqlite3.Row
    
    # Let's find an order to delete
    order = conn.execute("SELECT * FROM orders LIMIT 1").fetchone()
    if not order:
        print("No orders found to test delete")
        return
        
    order_id = order['id']
    print(f"Testing delete for order ID: {order_id}")
    
    # Let's run the exact queries in transaction
    try:
        conn.execute("BEGIN TRANSACTION")
        
        # 1. Get linked payments
        linked_payments = conn.execute("SELECT id, amount, createdAt, method FROM payments WHERE orderId = ?", (order_id,)).fetchall()
        
        # 2. Insert into deleted_orders
        conn.execute(
            """INSERT INTO deleted_orders (id, shopId, billNumber, customerId, customerName, customerPhone, totalAmount, items, createdAt, deletedAt, deletedBy, originalPaymentStatus, paidAmount, returnStatus, approvedBy, originalPaymentMethod, payments, refundMethod, returnedAt, refundStatus) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                order['id'],
                order['shopId'] or 'SHOP_01',
                order['billNumber'] or '',
                order['customerId'] or '',
                order['customerName'] or '',
                order['customerPhone'] or '',
                order['totalAmount'] or 0,
                order['items'] or '[]',
                order['createdAt'],
                '2026-07-14T16:20:00Z',
                'Super Admin: Admin',
                order['paymentStatus'] or 'Pending',
                order['paidAmount'] or 0,
                'Return Pending',
                'Shop Settings PIN',
                order['paymentMethod'] or 'CASH',
                json.dumps([dict(p) for p in linked_payments]),
                None,
                None,
                'Converted to Advance'
            )
        )
        
        # 3. Delete payments
        conn.execute("DELETE FROM payments WHERE orderId = ?", (order_id,))
        
        # 4. Delete order
        conn.execute("DELETE FROM orders WHERE id = ?", (order_id,))
        
        # 5. Insert unlinked payment
        conn.execute(
            """INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference) 
               VALUES (?, ?, NULL, ?, ?, 'Refund Advance', 'SUCCESS', ?, 0, ?, ?)""",
            (
                f"ADV-CONV-TEST",
                order['customerId'],
                order['shopId'] or 'SHOP_01',
                order['paidAmount'] or 0,
                '2026-07-14T16:20:00Z',
                '2026-07-14T16:20:00Z',
                'ADV-TEST-REF'
            )
        )
        
        print("Success! All queries executed successfully without any SQL error.")
        conn.rollback() # Rollback so we don't actually delete it
    except Exception as e:
        print(f"Error occurred:")
        traceback.print_exc()
        conn.rollback()

simulate_delete()
