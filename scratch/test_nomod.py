import urllib.request
import json

api_key = 'sk_live_DPzibTYc.9sH3InxdK3EgOlJoiRXCeKuvzBkNDbSn'
url = 'https://api.nomod.com/v1/checkout'
data = json.dumps({
    "amount": "1.00",
    "currency": "AED",
    "reference_id": "TEST-2"
}).encode('utf-8')

req = urllib.request.Request(url, data=data, headers={
    'X-API-KEY': api_key,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}, method='POST')

try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Response:", response.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
    if hasattr(e, 'read'):
        print("Error Body:", e.read().decode('utf-8'))
