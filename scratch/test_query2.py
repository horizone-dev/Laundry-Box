import sqlite3
import json

def test():
    conn = sqlite3.connect('laundry_pos.sqlite')
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM orders WHERE status='Cancelled'")
    print("Cancelled orders:", cursor.fetchone()[0])
    cursor.execute("SELECT COUNT(*) FROM deleted_orders")
    print("Deleted orders:", cursor.fetchone()[0])
if __name__ == '__main__':
    test()
