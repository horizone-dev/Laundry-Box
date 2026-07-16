import urllib.request
import json

api_key = 'sk_live_DPzibTYc.9sH3InxdK3EgOlJoiRXCeKuvzBkNDbSn'
url = 'https://api.nomod.dev/v1/checkout'

payload = json.dumps({
    "reference_id": "TEST-1234",
    "amount": "1.00",
    "currency": "AED",
    "success_url": "https://example.com/success",
    "items": [
        {
            "item_id": "1",
            "name": "Test Item",
            "quantity": 1,
            "unit_amount": "1.00",
            "total_amount": "1.00"
        }
    ]
}).encode('utf-8')

headers = {
    'X-API-KEY': api_key,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0'
}

req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Response:", response.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
    if hasattr(e, 'read'):
        print("Error Body:", e.read().decode('utf-8'))
