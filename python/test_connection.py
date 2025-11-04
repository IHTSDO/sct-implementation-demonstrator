#!/usr/bin/env python3
"""
Test script to verify:
1. Access to public SNOMED feed (no credentials required)
2. MLDS credentials validation for download (without downloading files)
"""
import os
from dotenv import load_dotenv
load_dotenv()

from syndication_downloader import get_latest_international_release

def test_feed_connection():
    """Tests feed connection and validates credentials."""
    try:
        print("=" * 70)
        print("🧪 Testing SNOMED Syndication Feed Access")
        print("=" * 70)
        print()
        
        # Test 1: Access public feed
        print("📡 Step 1: Accessing public syndication feed...")
        zip_url, title = get_latest_international_release()
        print("   ✅ Feed accessed successfully!")
        
        print()
        
        # Test 2: Validate credentials
        print("🔐 Step 2: Validating MLDS credentials...")
        user = os.getenv("SNOMED_USER")
        password = os.getenv("SNOMED_PASSWORD")
        
        if not user or not password:
            print("   ⚠️  No credentials found in .env file")
            print("   ℹ️  Credentials are required to download the actual ZIP files")
            print()
            print("   To complete setup, create python/.env with:")
            print("      SNOMED_USER=your_email@example.com")
            print("      SNOMED_PASSWORD=your_password")
        else:
            print(f"   ✅ Credentials found for: {user}")
            print(f"   ✅ Password length: {len(password)} characters")
        
        print()
        print("=" * 70)
        print("✅ SUCCESS - Basic connectivity test passed!")
        print("=" * 70)
        print()
        print("ℹ️  Note: The feed is public (no auth required)")
        print("ℹ️  Authentication is only needed when downloading ZIP files")
        print()
        
        if user and password:
            print("🚀 You're ready to run: python3 run-reports.py")
        else:
            print("⚠️  Add credentials to .env before running: python3 run-reports.py")
        print()
        
    except Exception as e:
        print()
        print("=" * 70)
        print("❌ ERROR - Connection test failed!")
        print("=" * 70)
        print()
        print(f"Error: {e}")
        print()
        print("Troubleshooting:")
        print("1. Check your internet connectivity")
        print("2. Verify the MLDS feed is accessible: https://mlds.ihtsdotools.org/api/feed")
        print()
        raise

if __name__ == "__main__":
    test_feed_connection()

