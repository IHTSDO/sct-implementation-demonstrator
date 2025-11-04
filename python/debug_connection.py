#!/usr/bin/env python3
"""
Detailed debug script to diagnose MLDS connection issues.
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

def test_connection_detailed():
    """Detailed test of MLDS feed connection."""
    
    print("=" * 70)
    print("🔍 SNOMED MLDS Connection Debug")
    print("=" * 70)
    print()
    
    # 1. Verificar variables de entorno
    print("1️⃣  Checking environment variables...")
    user = os.getenv("SNOMED_USER")
    password = os.getenv("SNOMED_PASSWORD")
    
    if not user:
        print("   ❌ SNOMED_USER not found in .env")
        return
    else:
        print(f"   ✅ SNOMED_USER: {user}")
    
    if not password:
        print("   ❌ SNOMED_PASSWORD not found in .env")
        return
    else:
        print(f"   ✅ SNOMED_PASSWORD: {'*' * len(password)} ({len(password)} characters)")
    
    print()
    
    # 2. Test feed access (public, no auth needed)
    print("2️⃣  Testing public feed access...")
    feed_url = "https://mlds.ihtsdotools.org/api/feed"
    
    try:
        response = requests.get(feed_url, timeout=10)
        print(f"   Status code: {response.status_code}")
        
        if response.status_code == 200:
            print("   ✅ Feed accessed successfully!")
            print(f"   Content length: {len(response.content)} bytes")
            print(f"   Content type: {response.headers.get('content-type', 'unknown')}")
            
            # Try to parse a bit of the feed
            content_preview = response.text[:500]
            if "<?xml" in content_preview:
                print("   ✅ Valid XML response detected")
            if "SNOMED" in content_preview:
                print("   ✅ SNOMED content detected")
            
            print()
            print("   ℹ️  Note: The syndication feed is PUBLIC (no authentication required)")
            print("   ℹ️  Authentication is only needed when downloading the ZIP files")
                
        else:
            print(f"   ❌ Unexpected status code: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            
    except requests.exceptions.Timeout:
        print("   ❌ Request timed out")
        print("   Check your internet connection")
    except requests.exceptions.ConnectionError as e:
        print(f"   ❌ Connection error: {e}")
        print("   Check your internet connection")
    except Exception as e:
        print(f"   ❌ Unexpected error: {e}")
        return
    
    print()
    
    # 3. Validate credentials (for ZIP download)
    print("3️⃣  Validating download credentials...")
    if user and password:
        print(f"   ✅ Username: {user}")
        print(f"   ✅ Password: {'*' * len(password)} ({len(password)} chars)")
        print()
        print("   ℹ️  Note: Credentials will be tested when you actually download a ZIP file")
        print("   ℹ️  Run 'python3 run-reports.py' to test the full download process")
    else:
        print("   ⚠️  No credentials configured")
        print("   You'll need credentials to download ZIP files")
    
    print()
    print("=" * 70)

if __name__ == "__main__":
    test_connection_detailed()

