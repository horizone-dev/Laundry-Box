import sqlite3
import json

db_path = 'C:\\Users\\Orbix Soft. Solution\\AppData\\Roaming\\laundry-box\\laundry_pos.sqlite'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

try:
    cursor.execute("SELECT * FROM customers WHERE phone = '+971588851680'")
    customer = cursor.fetchone()
    if customer:
        cust_id = customer['id']
        print("CUSTOMER:", dict(customer))

        print("\n--- ORDERS ---")
        cursor.execute("SELECT * FROM orders WHERE customerId = ?", (cust_id,))
        for r in cursor.fetchall():
            print(dict(r))

        print("\n--- DELETED ORDERS ---")
        cursor.execute("SELECT * FROM deleted_orders WHERE customerId = ?", (cust_id,))
        for r in cursor.fetchall():
            print(dict(r))

        print("\n--- PAYMENTS ---")
        cursor.execute("SELECT * FROM payments WHERE customerId = ?", (cust_id,))
        for r in cursor.fetchall():
            print(dict(r))

        print("\n--- ADVANCE ALLOCATIONS ---")
        cursor.execute("""
            SELECT a.* FROM advance_allocations a
            JOIN payments p ON a.paymentId = p.id
            WHERE p.customerId = ?
        """, (cust_id,))
        for r in cursor.fetchall():
            print(dict(r))
except Exception as e:
    print(e)
finally:
    conn.close()
