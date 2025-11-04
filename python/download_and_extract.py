import os
import zipfile
import requests
from tqdm import tqdm

def download_and_extract_snomed(url, output_dir="data"):
    """
    Download the SNOMED International release ZIP (with authentication) and extract it.
    Returns the path to the extracted folder.
    """
    os.makedirs(output_dir, exist_ok=True)
    zip_path = os.path.join(output_dir, "snomed_release.zip")

    print(f"Downloading SNOMED release...")
    auth_user = os.getenv("SNOMED_USER")
    auth_pass = os.getenv("SNOMED_PASSWORD")

    # Create a session to handle cookies/session-based auth
    session = requests.Session()
    session.auth = (auth_user, auth_pass)
    
    # Download with progress bar
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
        
        # Download with progress bar
        with open(zip_path, "wb") as f:
            with tqdm(
                total=total_size,
                unit='B',
                unit_scale=True,
                unit_divisor=1024,
                desc="Download progress"
            ) as pbar:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
                    pbar.update(len(chunk))

    print(f"✓ Downloaded {os.path.getsize(zip_path) / (1024*1024):.1f} MB")
    print("Extracting ZIP file...")
    
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        # Extract with progress
        members = zip_ref.namelist()
        with tqdm(total=len(members), desc="Extraction progress") as pbar:
            for member in members:
                zip_ref.extract(member, output_dir)
                pbar.update(1)

    # Clean up ZIP file
    os.remove(zip_path)
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
    print(f"✓ SNOMED release extracted to: {os.path.basename(release_root)}")
    return release_root
