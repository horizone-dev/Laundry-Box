import urllib.request
import json

api_key = 'sk_live_DPzibTYc.9sH3InxdK3EgOlJoiRXCeKuvzBkNDbSn'
url = 'https://api.nomod.com/v1/links'

payload = {
    "title": "Test Link Creation",
    "amount": "1.00",
    "currency": "AED",
    "description": "Payment link generated via API",
    "items": [
        {
            "name": "Test Product",
            "amount": "1.00"
        }
    ]
}

headers = {
    'X-API-KEY': api_key,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0'
}

req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Response:", response.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
    if hasattr(e, 'read'):
        print("Error Body:", e.read().decode('utf-8'))
