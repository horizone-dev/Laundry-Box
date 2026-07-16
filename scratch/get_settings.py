import sqlite3
import json

def get_settings():
    conn = sqlite3.connect(r'C:\Users\Orbix Soft. Solution\AppData\Roaming\laundry-box\laundry_pos.sqlite')
    conn.row_factory = sqlite3.Row
    shop = conn.execute("SELECT settings FROM shops LIMIT 1").fetchone()
    if shop:
        settings = json.loads(shop['settings'])
        print("Enable Nomod:", settings.get('enableNomod'))
        print("Nomod API Key:", settings.get('nomodApiKey'))
        print("Nomod Env:", settings.get('nomodEnv'))
        print("Nomod Merchant ID:", settings.get('nomodMerchantId'))
    else:
        print("No shop found.")

get_settings()
