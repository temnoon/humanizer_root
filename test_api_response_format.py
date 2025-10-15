#!/usr/bin/env python3
"""Check the exact format of API response."""

import requests
import json

response = requests.post(
    "http://localhost:8000/api/personify/llm",
    json={"text": "This is a test message.", "strength": 1.0},
    timeout=30
)

print("Status:", response.status_code)
print("\nResponse JSON:")
data = response.json()
print(json.dumps(data, indent=2))

print("\n" + "="*60)
print("Field Analysis:")
print("="*60)
print(f"Keys in response: {list(data.keys())}")
print(f"\n'text' field exists: {'text' in data}")
print(f"'text' value: {data.get('text', 'MISSING')}")
print(f"\n'transformed_text' field exists: {'transformed_text' in data}")
print(f"'transformed_text' value: {data.get('transformed_text', 'MISSING')}")
print(f"\n'original_text' field exists: {'original_text' in data}")
print(f"'original_text' value: {data.get('original_text', 'MISSING')}")
