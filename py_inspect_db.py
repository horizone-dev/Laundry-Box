import sqlite3
import os
import shutil
import json

appdata = os.environ['APPDATA']
prod_db_path = os.path.join(appdata, 'Laundry Box', 'laundry_pos.sqlite')
audit_db_path = os.path.join(os.getcwd(), 'audit_laundry_pos.sqlite')

shutil.copyfile(prod_db_path, audit_db_path)
print(f"Copied live DB from {prod_db_path} to {audit_db_path}")

conn = sqlite3.connect(audit_db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Get all tables
cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [r[0] for r in cur.fetchall()]
print(f"Found {len(tables)} tables: {tables}")

# Print schemas and row counts for key tables
key_tables = [
    'customers', 'orders', 'payments', 'advance_allocations',
    'account_transactions', 'payment_links', 'z_reports', 'settlements',
    'settlement_history', 'cash_in_out'
]

for t in key_tables:
    if t in tables:
        cur.execute(f"PRAGMA table_info({t});")
        cols = [r['name'] for r in cur.fetchall()]
        cur.execute(f"SELECT count(*) as c FROM {t};")
        cnt = cur.fetchone()['c']
        print(f"\nTable '{t}' ({cnt} rows):")
        print(" Columns:", cols)
    else:
        print(f"\nTable '{t}': NOT FOUND")

conn.close()
