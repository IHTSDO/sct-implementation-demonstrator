import os
import re

def parse_snomed_release_date(root_folder: str) -> str:
    """
    Extracts the YYYYMMDD date (e.g. '20250201') from the final component 
    of the root_folder name, which typically has something like:
    'SnomedCT_InternationalRF2_PRODUCTION_20250201T120000Z'.
    """
    folder_name = os.path.basename(root_folder.rstrip("/"))
    match = re.search(r'(\d{8})T\d+', folder_name)
    if not match:
        raise ValueError(
            f"Could not find an 8-digit date in the folder name: {folder_name}"
        )
    return match.group(1)

def getFilePath(root_folder: str, 
                file_type: str, 
                release_type: str, 
                language: str = "en") -> str:
    """
    Constructs the typical SNOMED file path given:
      - root_folder: e.g. "/Users/.../SnomedCT_InternationalRF2_PRODUCTION_20250201T120000Z"
      - file_type: one of ["concept", "description", "refset_inactivation", "refset_historical"]
      - release_type: one of ["full", "snapshot"] 
      - language: only used for descriptions (default "en")

    Returns: absolute path to the file, e.g.:
      "/Users/.../Full/Terminology/sct2_Concept_Full_INT_20250201.txt"
    """
    # 1) Parse date from folder
    release_date = parse_snomed_release_date(root_folder)

    # 2) Define subfolders for "full" or "snapshot"
    release_type = release_type.lower()
    if release_type == "full":
        folder_segment = "Full"
    elif release_type == "snapshot":
        folder_segment = "Snapshot"
    else:
        raise ValueError(f"Unknown release_type: {release_type}. Must be 'full' or 'snapshot'.")

    # 3) Based on file_type, figure out subpath & filename pattern
    file_type = file_type.lower()

    if file_type == "concept":
        # sct2_Concept_Full_INT_YYYYMMDD.txt or
        # sct2_Concept_Snapshot_INT_YYYYMMDD.txt
        file_name = f"sct2_Concept_{release_type.capitalize()}_INT_{release_date}.txt"
        sub_dir = "Terminology"

    elif file_type == "description":
        # sct2_Description_Full-en_INT_YYYYMMDD.txt or
        # sct2_Description_Snapshot-en_INT_YYYYMMDD.txt
        file_name = f"sct2_Description_{release_type.capitalize()}-{language}_INT_{release_date}.txt"
        sub_dir = "Terminology"

    elif file_type == "refset_inactivation":
        # Typically: der2_cRefset_AttributeValueFull_INT_YYYYMMDD.txt
        # There's no snapshot version for the attribute-value refset in most distributions.
        # But if we did: der2_cRefset_AttributeValueSnapshot_INT_YYYYMMDD.txt
        # We'll assume "full" for inactivation; or if the user calls snapshot, we'd adapt.
        if release_type == "full":
            file_name = f"der2_cRefset_AttributeValueFull_INT_{release_date}.txt"
        else:
            file_name = f"der2_cRefset_AttributeValueSnapshot_INT_{release_date}.txt"
        sub_dir = os.path.join("Refset", "Content")

    elif file_type == "refset_historical":
        # Typically: der2_cRefset_AssociationFull_INT_YYYYMMDD.txt
        # or        der2_cRefset_AssociationSnapshot_INT_YYYYMMDD.txt
        if release_type == "full":
            file_name = f"der2_cRefset_AssociationFull_INT_{release_date}.txt"
        else:
            file_name = f"der2_cRefset_AssociationSnapshot_INT_{release_date}.txt"
        sub_dir = os.path.join("Refset", "Content")

    else:
        raise ValueError(f"Unknown file_type: {file_type}")

    # 4) Construct the final absolute path
    full_path = os.path.join(root_folder, folder_segment, sub_dir, file_name)
    return full_path
