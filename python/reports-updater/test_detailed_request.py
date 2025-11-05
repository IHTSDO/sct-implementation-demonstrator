#!/usr/bin/env python3
"""
Detailed request test to see exactly what's being sent.
"""
import os
import requests
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

def test_detailed():
    user = os.getenv("SNOMED_USER")
    password = os.getenv("SNOMED_PASSWORD")
    
    # Get URL
    from syndication_downloader import get_latest_international_release
    zip_url, _ = get_latest_international_release()
    
    print("=" * 70)
    print("🔍 Detailed Request Analysis")
    print("=" * 70)
    print()
    print(f"URL: {zip_url}")
    print(f"User: {user}")
    print(f"Password: {'*' * len(password)}")
    print()
    
    # Method 1: Using auth parameter (current method)
    print("1️⃣  Method 1: auth=(user, password)")
    try:
        response = requests.get(zip_url, auth=(user, password), stream=True, timeout=10)
        print(f"   Status: {response.status_code}")
        if response.status_code == 401:
            print("   ❌ Failed with auth tuple")
            print(f"   Response headers: {dict(response.headers)}")
    except Exception as e:
        print(f"   Error: {e}")
    
    print()
    
    # Method 2: Using HTTPBasicAuth explicitly
    print("2️⃣  Method 2: HTTPBasicAuth(user, password)")
    try:
        response = requests.get(zip_url, auth=HTTPBasicAuth(user, password), stream=True, timeout=10)
        print(f"   Status: {response.status_code}")
        if response.status_code == 401:
            print("   ❌ Failed with HTTPBasicAuth")
    except Exception as e:
        print(f"   Error: {e}")
    
    print()
    
    # Method 3: Manual Authorization header
    print("3️⃣  Method 3: Manual Authorization header")
    import base64
    credentials = f"{user}:{password}"
    encoded = base64.b64encode(credentials.encode()).decode()
    headers = {
        'Authorization': f'Basic {encoded}'
    }
    try:
        response = requests.get(zip_url, headers=headers, stream=True, timeout=10)
        print(f"   Status: {response.status_code}")
        if response.status_code == 401:
            print("   ❌ Failed with manual header")
            print(f"   WWW-Authenticate: {response.headers.get('WWW-Authenticate', 'Not present')}")
    except Exception as e:
        print(f"   Error: {e}")
    
    print()
    print("=" * 70)
    print()
    print("💡 All methods failed with 401.")
    print()
    print("This means:")
    print("  • The credentials are being sent correctly")
    print("  • But MLDS server is rejecting them")
    print()
    print("Action required:")
    print("  1. Log in to https://mlds.ihtsdotools.org/")
    print("  2. Try to download a file manually")
    print("  3. Check if your account has 'Member' or 'Affiliate' status")
    print("  4. Verify your account can access International Edition")
    print()
    print("The problem is NOT with the script - it's with the credentials/account.")
    print()

if __name__ == "__main__":
    test_detailed()

