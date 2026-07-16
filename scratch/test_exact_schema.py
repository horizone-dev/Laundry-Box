import urllib.request
import json

api_key = 'sk_live_DPzibTYc.9sH3InxdK3EgOlJoiRXCeKuvzBkNDbSn'
url = 'https://api.nomod.com/v1/checkout'

payload = {
    "reference_id": "LNK-TEST-5555",
    "amount": "1.00",
    "currency": "AED",
    "success_url": "https://pay.lundry.ae/success",
    "failure_url": "https://pay.lundry.ae/failure",
    "cancelled_url": "https://pay.lundry.ae/cancelled",
    "items": [
        {
            "item_id": "item_1",
            "name": "Laundry Service Payment",
            "quantity": 1,
            "unit_amount": "1.00",
            "total_amount": "1.00"
        }
    ],
    "customer": {
        "first_name": "Test",
        "last_name": "Customer",
        "phone_number": "+971500000000"
    },
    "metadata": {
        "orderId": "9999",
        "description": "Test order payment"
    }
}

headers = {
    'X-API-KEY': api_key,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0'
}

print("Outgoing Request Payload:")
print(json.dumps(payload, indent=2))
print("\nOutgoing Request Headers (Masked):")
masked_key = f"{api_key[:8]}...{api_key[-4:]}"
print(f"X-API-KEY: {masked_key}")
print("Content-Type: application/json")

req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
try:
    with urllib.request.urlopen(req) as response:
        print("\nResponse Status:", response.status)
        print("Response Headers:")
        for k, v in response.getheaders():
            print(f"  {k}: {v}")
        print("Response Body:", response.read().decode('utf-8'))
except Exception as e:
    print("\nRequest Failed:")
    print("Error:", e)
    if hasattr(e, 'read'):
        print("Response Status:", getattr(e, 'code', 'N/A'))
        print("Response Headers:")
        if hasattr(e, 'headers'):
            for k, v in e.headers.items():
                print(f"  {k}: {v}")
        print("Response Body:", e.read().decode('utf-8'))
