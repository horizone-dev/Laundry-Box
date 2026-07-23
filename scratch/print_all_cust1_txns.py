import sqlite3, os

p = os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', 'laundry-box', 'laundry_pos.sqlite')
conn = sqlite3.connect(p)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Get customer CUST-412 (qrt) orders and deleted orders
orders = [dict(o) for o in cur.execute("SELECT * FROM orders WHERE customerId = 'CUST-412'").fetchall()]
del_orders = [dict(o) for o in cur.execute("SELECT * FROM deleted_orders WHERE customerId = 'CUST-412'").fetchall()]
payments = [dict(pmt) for pmt in cur.execute("SELECT * FROM payments WHERE customerId = 'CUST-412'").fetchall()]

print("ORDERS:", orders)
print("DELETED ORDERS:", del_orders)
print("PAYMENTS:", payments)
