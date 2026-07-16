import sqlite3
import json

def test():
    conn = sqlite3.connect(r'C:\Users\Orbix Soft. Solution\AppData\Roaming\laundry-box\laundry_pos.sqlite')
    cursor = conn.cursor()
    
    query = """
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
        WHERE u.customerId = 'CUST-2'
    """
    try:
        cursor.execute(query)
        rows = cursor.fetchall()
        print(f"Success! {len(rows)} rows returned.")
        for r in rows:
            print(f"id={r[0]}, isDeleted={r[13]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    test()
