import os
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from download_and_extract import download_and_extract_snomed
from ci_utils import is_ci, log

ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}
NCTS_NS = {"ncts": "http://ns.electronichealth.net.au/ncts/syndication/asf/extensions/1.0.0"}
SCT_NS = {"sct": "http://snomed.info/syndication/sct-extension/1.0.0"}

# Acceptable package types (similar to Java client)
ACCEPTABLE_PACKAGE_TYPES = {"SCT_RF2_SNAPSHOT", "SCT_RF2_FULL", "SCT_RF2_ALL"}

def get_latest_international_release(feed_url="https://mlds.ihtsdotools.org/api/feed"):
    """
    Parse the SNOMED syndication Atom feed and find the latest
    'SNOMED CT International Edition' entry with a ZIP link.
    Filters by acceptable package types (RF2 ALL/FULL/SNAPSHOT).
    
    Note: The feed itself is public and doesn't require authentication.
    Authentication is only needed when downloading the actual ZIP files.
    """
    log("Fetching syndication feed (public access)...")
    
    # The feed is public, no authentication needed
    response = requests.get(feed_url)
    response.raise_for_status()

    tree = ET.fromstring(response.content)
    entries = []

    for entry in tree.findall("atom:entry", ATOM_NS):
        title_el = entry.find("atom:title", ATOM_NS)
        title = title_el.text if title_el is not None else ""
        
        # Filter for International Edition only
        if "SNOMED CT International Edition" not in title:
            continue

        # Check category term (similar to Java client)
        category = entry.find("atom:category", ATOM_NS)
        if category is not None:
            category_term = category.attrib.get("term", "")
            if category_term not in ACCEPTABLE_PACKAGE_TYPES:
                continue
        else:
            continue

        # Get dates
        updated_el = entry.find("atom:updated", ATOM_NS)
        updated = updated_el.text if updated_el is not None else None
        
        published_el = entry.find("atom:published", ATOM_NS)
        published = published_el.text if published_el is not None else None

        # Get contentItemVersion for sorting
        content_version_el = entry.find("ncts:contentItemVersion", NCTS_NS)
        content_version = content_version_el.text if content_version_el is not None else ""

        # Get the ZIP link
        zip_link = None
        for link in entry.findall("atom:link", ATOM_NS):
            if link.attrib.get("type") == "application/zip":
                zip_link = link.attrib.get("href")
                break

        if zip_link and updated:
            entries.append({
                "title": title,
                "updated": updated,
                "published": published,
                "content_version": content_version,
                "category": category_term,
                "zip_url": zip_link
            })

    if not entries:
        raise RuntimeError(
            "No International Edition found in the syndication feed with acceptable package types. "
            "Check your MLDS credentials and access permissions."
        )

    # Sort by contentItemVersion descending (similar to Java client)
    # Fallback to updated date if content_version is not available
    def sort_key(entry):
        if entry["content_version"]:
            return entry["content_version"]
        return entry["updated"]
    
    entries.sort(key=sort_key, reverse=True)
    latest = entries[0]

    log(f"✓ Latest International Edition: {latest['title']}")
    log(f"  Published: {latest.get('published', 'N/A')}")
    log(f"  Version: {latest['content_version']}")
    log(f"  Package Type: {latest['category']}")
    
    # Extract filename from URL
    zip_url = latest['zip_url']
    url_filename = os.path.basename(zip_url.split('?')[0]) if zip_url else "unknown"
    log(f"  Download filename: {url_filename}")
    log(f"  Download URL: {zip_url[:80]}...")
    
    return zip_url, latest["title"]


def download_latest_international(download_dir="data"):
    """
    Downloads and extracts the latest International Edition release.
    Requires SNOMED_USER and SNOMED_PASSWORD for downloading the ZIP file.
    """
    # Validate credentials before attempting download
    user = os.getenv("SNOMED_USER")
    password = os.getenv("SNOMED_PASSWORD")
    
    if not user or not password:
        raise RuntimeError(
            "SNOMED_USER and SNOMED_PASSWORD environment variables must be set. "
            "Create a .env file in the python directory with your MLDS credentials.\n"
            "Note: Credentials are needed to download the ZIP files (not for reading the feed)."
        )
    
    log(f"📋 Credentials found for: {user}")
    log("")
    
    zip_url, title = get_latest_international_release()
    log("")
    log(f"📥 Downloading SNOMED International Edition: {title}")
    root_folder = download_and_extract_snomed(zip_url, output_dir=download_dir)
    return root_folder


if __name__ == "__main__":
    download_latest_international()
