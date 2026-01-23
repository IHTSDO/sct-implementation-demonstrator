import os
import zipfile
import requests
from tqdm import tqdm
from ci_utils import is_ci, log

def download_and_extract_snomed(url, output_dir="data"):
    """
    Download the SNOMED International release ZIP (with authentication) and extract it.
    Returns the path to the extracted folder.
    """
    os.makedirs(output_dir, exist_ok=True)
    zip_path = os.path.join(output_dir, "snomed_release.zip")

    # Extract filename from URL for logging
    url_filename = os.path.basename(url.split('?')[0]) if url else "unknown"
    log(f"📦 Download URL filename: {url_filename}")
    log(f"📦 Full URL: {url[:100]}..." if len(url) > 100 else f"📦 Full URL: {url}")
    
    if not is_ci():
        print(f"Downloading SNOMED release...")
    auth_user = os.getenv("SNOMED_USER")
    auth_pass = os.getenv("SNOMED_PASSWORD")

    # Create a session to handle cookies/session-based auth
    session = requests.Session()
    session.auth = (auth_user, auth_pass)
    
    # Download with progress bar (disabled in CI)
    with session.get(url, stream=True) as r:
        if r.status_code == 401:
            raise RuntimeError(
                f"Authentication failed (401 Unauthorized).\n"
                f"Username: {auth_user}\n"
                f"Download URL: {url[:100]}...\n\n"
                f"Please verify:\n"
                f"  1. Your credentials are correct at https://mlds.ihtsdotools.org/\n"
                f"  2. You can download files manually from the website\n"
                f"  3. Your account has 'Member' or 'Affiliate' status\n"
                f"  4. Your account has access to SNOMED CT International Edition\n\n"
                f"Note: Access to the syndication feed (list) is public,\n"
                f"but downloading files requires proper MLDS membership."
            )
        r.raise_for_status()
        
        # Get total file size
        total_size = int(r.headers.get('content-length', 0))
        
        # Download with progress bar (disabled in CI)
        with open(zip_path, "wb") as f:
            with tqdm(
                total=total_size,
                unit='B',
                unit_scale=True,
                unit_divisor=1024,
                desc="Download progress",
                disable=is_ci()
            ) as pbar:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
                    pbar.update(len(chunk))

    if not is_ci():
        print(f"✓ Downloaded {os.path.getsize(zip_path) / (1024*1024):.1f} MB")
        print("Extracting ZIP file...")
    
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        # Log top-level folders/files in ZIP before extraction
        members = zip_ref.namelist()
        top_level_items = set()
        for member in members:
            # Get top-level directory/file name
            top_level = member.split('/')[0] if '/' in member else member
            if top_level:
                top_level_items.add(top_level)
        
        log(f"📂 Top-level items in ZIP: {', '.join(sorted(top_level_items)[:5])}")
        if len(top_level_items) > 5:
            log(f"   ... and {len(top_level_items) - 5} more items")
        
        # Extract with progress (disabled in CI)
        with tqdm(total=len(members), desc="Extraction progress", disable=is_ci()) as pbar:
            for member in members:
                zip_ref.extract(member, output_dir)
                pbar.update(1)

    # Clean up ZIP file
    os.remove(zip_path)
    if not is_ci():
        print("✓ ZIP file cleaned up")

    # Detect top-level folder
    extracted_dirs = [
        os.path.join(output_dir, d)
        for d in os.listdir(output_dir)
        if os.path.isdir(os.path.join(output_dir, d)) and "SnomedCT_" in d
    ]
    if not extracted_dirs:
        raise FileNotFoundError("No SNOMED folder found after extraction.")
    
    release_root = extracted_dirs[0]
    folder_name = os.path.basename(release_root)
    if not is_ci():
        print(f"✓ SNOMED release extracted to: {folder_name}")
    
    log(f"📁 Extracted folder name: {folder_name}")
    
    # If multiple folders found, warn
    if len(extracted_dirs) > 1:
        log(f"⚠ Warning: Multiple SNOMED folders found, using: {folder_name}")
        log(f"   Other folders: {', '.join([os.path.basename(d) for d in extracted_dirs[1:]])}")
    
    return release_root
