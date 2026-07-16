import sqlite3
def test():
    conn = sqlite3.connect(r'C:\Users\Orbix Soft. Solution\AppData\Roaming\laundry-box\laundry_pos.sqlite')
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM orders WHERE status='Cancelled'")
    print("Cancelled orders:", cursor.fetchone()[0])
if __name__ == '__main__':
    test()
