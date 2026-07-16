import urllib.request
import json

api_key = 'sk_live_DPzibTYc.9sH3InxdK3EgOlJoiRXCeKuvzBkNDbSn'
link_id = 'd1e8e725-fe44-4a1f-b6e4-c869e38c5b8f'
url = f'https://api.nomod.com/v1/charges?link_id={link_id}'

headers = {
    'X-API-KEY': api_key,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0'
}

req = urllib.request.Request(url, headers=headers, method='GET')
try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Response:", json.dumps(json.loads(response.read().decode('utf-8')), indent=2))
except Exception as e:
    print("Error:", e)
    if hasattr(e, 'read'):
        print("Error Body:", e.read().decode('utf-8'))
