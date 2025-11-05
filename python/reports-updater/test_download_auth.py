#!/usr/bin/env python3
"""
Test script to verify download authentication works correctly.
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

def test_download_auth():
    """Test if credentials work for downloading ZIP files."""
    
    user = os.getenv("SNOMED_USER")
    password = os.getenv("SNOMED_PASSWORD")
    
    if not user or not password:
        print("❌ No credentials found in .env")
        return
    
    print("=" * 70)
    print("🔐 Testing Download Authentication")
    print("=" * 70)
    print()
    
    # Get the latest release URL
    print("1️⃣  Getting latest release URL from feed...")
    from syndication_downloader import get_latest_international_release
    
    try:
        zip_url, title = get_latest_international_release()
        print(f"   ✅ Found: {title}")
        print(f"   URL: {zip_url[:100]}...")
        print()
    except Exception as e:
        print(f"   ❌ Error getting feed: {e}")
        return
    
    # Test OPTIONS request (like Java client does)
    print("2️⃣  Testing OPTIONS request (credential verification)...")
    try:
        response = requests.options(zip_url, auth=(user, password), timeout=10)
        print(f"   Status code: {response.status_code}")
        
        if response.status_code in [200, 204]:
            print("   ✅ OPTIONS request successful")
        else:
            print(f"   ⚠️  Unexpected status: {response.status_code}")
    except requests.exceptions.HTTPError as e:
        print(f"   ❌ OPTIONS failed: {e.response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print()
    
    # Test HEAD request to check credentials without downloading
    print("3️⃣  Testing HEAD request (check file info)...")
    try:
        response = requests.head(zip_url, auth=(user, password), timeout=10)
        print(f"   Status code: {response.status_code}")
        
        if response.status_code == 200:
            print("   ✅ HEAD request successful")
            content_length = response.headers.get('content-length')
            if content_length:
                size_mb = int(content_length) / (1024 * 1024)
                print(f"   File size: {size_mb:.1f} MB")
        elif response.status_code == 401:
            print("   ❌ Authentication FAILED (401)")
            print()
            print("   Possible issues:")
            print("   • Credentials are incorrect")
            print("   • Account doesn't have download permissions")
            print("   • Password contains special characters that need escaping")
            print()
            print(f"   Username: {user}")
            print(f"   Password length: {len(password)} characters")
            print(f"   Password (masked): {'*' * len(password)}")
            print()
            print("   Try:")
            print("   1. Log in to https://mlds.ihtsdotools.org/ with these credentials")
            print("   2. Verify you can download files manually")
            print("   3. Check if password has special characters")
        else:
            print(f"   ⚠️  Unexpected status: {response.status_code}")
    except requests.exceptions.HTTPError as e:
        print(f"   ❌ HEAD failed: {e}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print()
    
    # Test small range request
    print("4️⃣  Testing Range request (download first 1KB)...")
    try:
        headers = {'Range': 'bytes=0-1023'}
        response = requests.get(
            zip_url, 
            auth=(user, password), 
            headers=headers,
            timeout=10
        )
        print(f"   Status code: {response.status_code}")
        
        if response.status_code in [200, 206]:
            print(f"   ✅ Downloaded {len(response.content)} bytes successfully")
            print("   ✅ CREDENTIALS ARE VALID!")
        elif response.status_code == 401:
            print("   ❌ Authentication FAILED")
        else:
            print(f"   ⚠️  Status: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print()
    print("=" * 70)

if __name__ == "__main__":
    test_download_auth()

