import sqlite3
import os

db_path = os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', 'laundry-box', 'laundry_pos.sqlite')

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Active Orders sum
    cursor.execute("SELECT SUM(totalAmount), SUM(paidAmount) FROM orders WHERE customerId = 'CUST-1' AND status != 'Cancelled'")
    active_orders = cursor.fetchone()
    print("Active Orders: totalAmount =", active_orders[0], "paidAmount =", active_orders[1])

    # Payments table sum
    cursor.execute("SELECT SUM(amount) FROM payments WHERE customerId = 'CUST-1'")
    total_payments = cursor.fetchone()[0] or 0.0
    print("Payments Table: total =", total_payments)

    # Payments table linked to orders
    cursor.execute("SELECT SUM(amount) FROM payments WHERE customerId = 'CUST-1' AND orderId IS NOT NULL AND orderId != ''")
    linked_payments = cursor.fetchone()[0] or 0.0
    print("Payments Table: linked =", linked_payments)

    # Payments table unlinked
    cursor.execute("SELECT SUM(amount) FROM payments WHERE customerId = 'CUST-1' AND (orderId IS NULL OR orderId = '')")
    unlinked_payments = cursor.fetchone()[0] or 0.0
    print("Payments Table: unlinked =", unlinked_payments)

    # Allocations sum
    cursor.execute("""
        SELECT SUM(a.amountUsed) FROM advance_allocations a
        JOIN payments p ON a.paymentId = p.id
        WHERE p.customerId = 'CUST-1'
    """)
    allocations_sum = cursor.fetchone()[0] or 0.0
    print("Allocations Sum:", allocations_sum)

    # Deleted orders sum
    cursor.execute("SELECT SUM(totalAmount), SUM(paidAmount) FROM deleted_orders WHERE customerId = 'CUST-1'")
    deleted_orders = cursor.fetchone()
    print("Deleted Orders: totalAmount =", deleted_orders[0], "paidAmount =", deleted_orders[1])

    conn.close()
except Exception as e:
    print("Error:", e)
