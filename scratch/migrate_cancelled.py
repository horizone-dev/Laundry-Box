import sqlite3
import os
import json
from datetime import datetime

def migrate_db(db_path):
    if not os.path.exists(db_path):
        return
        
    print(f"\nChecking database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if orders table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'")
    if not cursor.fetchone():
        print("  No orders table found.")
        conn.close()
        return

    cursor.execute("SELECT COUNT(*) FROM orders WHERE status = 'Cancelled'")
    count = cursor.fetchone()[0]
    print(f"  Found {count} cancelled orders.")
    
    if count == 0:
        conn.close()
        return
        
    # Fetch all cancelled orders
    cursor.execute("SELECT * FROM orders WHERE status = 'Cancelled'")
    columns = [description[0] for description in cursor.description]
    cancelled_orders = cursor.fetchall()
    
    migrated_count = 0
    for row in cancelled_orders:
        order = dict(zip(columns, row))
        
        # Check if already in deleted_orders
        cursor.execute("SELECT id FROM deleted_orders WHERE id = ?", (order['id'],))
        if cursor.fetchone():
            print(f"  Order {order['id']} already exists in deleted_orders. Deleting from orders...")
            cursor.execute("DELETE FROM orders WHERE id = ?", (order['id'],))
            migrated_count += 1
            continue
            
        # We need to fetch customer details since deleted_orders requires customerName, customerPhone
        cursor.execute("SELECT name, phone FROM customers WHERE id = ?", (order.get('customerId'),))
        cust = cursor.fetchone()
        cust_name = cust[0] if cust else "Unknown"
        cust_phone = cust[1] if cust else ""
        
        # Prepare deleted_orders record
        now_str = datetime.now().isoformat()
        
        # Construct insert
        insert_sql = """
            INSERT INTO deleted_orders (
                id, shopId, billNumber, customerId, customerName, customerPhone, 
                totalAmount, items, deletedAt, deletedBy, originalPaymentStatus, 
                paidAmount, returnStatus, approvedBy, originalPaymentMethod, 
                refundMethod, returnedAt, refundStatus, payments
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        insert_data = (
            order.get('id'),
            order.get('shopId', 'SHOP_01'),
            order.get('billNumber', ''),
            order.get('customerId', ''),
            cust_name,
            cust_phone,
            order.get('totalAmount', 0),
            order.get('items', '[]'),
            order.get('updatedAt') or now_str, # deletedAt
            'MigrationScript', # deletedBy
            order.get('paymentStatus', 'Pending'), # originalPaymentStatus
            order.get('paidAmount', 0), # paidAmount
            'N/A', # returnStatus
            'System', # approvedBy
            order.get('paymentMethod', 'CASH'), # originalPaymentMethod
            'None', # refundMethod
            now_str, # returnedAt
            'Deleted', # refundStatus
            '[]' # payments
        )
        
        cursor.execute(insert_sql, insert_data)
        
        # Delete from orders table to prevent orphans
        cursor.execute("DELETE FROM orders WHERE id = ?", (order['id'],))
        migrated_count += 1

    conn.commit()
    print(f"  Successfully migrated and cleaned up {migrated_count} orders.")
    conn.close()

if __name__ == '__main__':
    migrate_db('laundry_pos.sqlite')
    migrate_db('laundry.db')
