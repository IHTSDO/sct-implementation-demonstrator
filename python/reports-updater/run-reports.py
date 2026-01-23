#!/usr/bin/env python3
import os
import shutil
import time

from dotenv import load_dotenv
load_dotenv()

from detect_inactivations import detect_inactivations
from detect_inactivations_graph_details import generate_inactivation_report
from fsn_changes import detect_fsn_changes
from fsn_changes_graph_details import generate_fsn_changes_report
from new_concepts import detect_new_concepts
from new_concepts_graph_details import generate_new_concepts_report
from file_locator import getFilePath, parse_snomed_release_date
from syndication_downloader import download_latest_international
from ci_utils import is_ci, log

def cleanup_previous_data(data_dir="data"):
    """
    Remove all previous SNOMED extracted folders from the data directory.
    """
    if not os.path.exists(data_dir):
        return
    
    log("🧹 Cleaning up previous temporary data...")
    removed_count = 0
    
    for item in os.listdir(data_dir):
        item_path = os.path.join(data_dir, item)
        # Remove directories that look like SNOMED releases
        if os.path.isdir(item_path) and "SnomedCT_" in item:
            try:
                shutil.rmtree(item_path)
                removed_count += 1
                if not is_ci():
                    log(f"  ✓ Removed: {item}")
            except Exception as e:
                log(f"  ⚠ Warning: Could not remove {item}: {e}")
    
    if removed_count > 0:
        log(f"✓ Cleaned up {removed_count} previous release(s)")
    else:
        log("✓ No previous data to clean up")
    log("")

def main():
    # ------------------------------------------------------------------
    # 0. Clean up previous temporary data
    # ------------------------------------------------------------------
    cleanup_previous_data("data")
    
    # ------------------------------------------------------------------
    # 1. Descargar y extraer release SNOMED (vía syndication feed)
    # ------------------------------------------------------------------
    log("------------------------------------------------------")
    log("🔽 Downloading and extracting latest SNOMED International release...")
    log("------------------------------------------------------")

    root_folder = download_latest_international("data")
    log(f"Using release folder: {root_folder}")
    
    # Log parsed date from folder name
    try:
        parsed_date = parse_snomed_release_date(root_folder)
        log(f"📅 Parsed release date from folder name: {parsed_date}")
    except Exception as e:
        log(f"⚠ Warning: Could not parse date from folder name: {e}")

    # ------------------------------------------------------------------
    # 2. Localizar archivos RF2
    # ------------------------------------------------------------------
    log(f'Locating files in: {root_folder}')
    concept_full_path = getFilePath(root_folder, "concept", "full")
    concept_snapshot_path = getFilePath(root_folder, "concept", "snapshot")
    description_full_path = getFilePath(root_folder, "description", "full")
    description_snapshot_path = getFilePath(root_folder, "description", "snapshot")
    refset_inactivation_path = getFilePath(root_folder, "refset_inactivation", "full")
    refset_historical_associations_path = getFilePath(root_folder, "refset_historical", "full")

    # ------------------------------------------------------------------
    # 3. Output directories
    # ------------------------------------------------------------------
    # Excel files -> local output directory (not for web)
    output_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(output_dir, exist_ok=True)
    
    # HTML files -> Angular assets (for web serving)
    assets_dir = os.path.join(os.path.dirname(__file__), "../../src/assets/reports")
    os.makedirs(assets_dir, exist_ok=True)

    inactivations_xlsx = os.path.join(output_dir, "detect-inactivations.xlsx")
    inactivations_html = os.path.join(assets_dir, "detect_inactivations_by_reason.html")
    fsn_changes_xlsx = os.path.join(output_dir, "fsn-changes.xlsx")
    fsn_changes_html = os.path.join(assets_dir, "fsn_changes_with_details.html")
    new_concepts_xlsx = os.path.join(output_dir, "list-new-concepts.xlsx")
    new_concepts_html = os.path.join(assets_dir, "new_concepts_by_semantic_tag.html")

    # ------------------------------------------------------------------
    # 4. Generar reportes
    # ------------------------------------------------------------------
    log("------------------------------------------------------")
    log("🧮 Running SNOMED analytics pipeline...")
    log("------------------------------------------------------")

    detect_inactivations(
        concept_full_path,
        description_snapshot_path,
        refset_inactivation_path,
        refset_historical_associations_path,
        inactivations_xlsx
    )
    generate_inactivation_report(inactivations_xlsx, inactivations_html, 1500)

    detect_fsn_changes(
        description_full_path,
        concept_snapshot_path,
        fsn_changes_xlsx
    )
    generate_fsn_changes_report(fsn_changes_xlsx, fsn_changes_html, 1500)

    detect_new_concepts(
        concept_full_path,
        description_snapshot_path,
        new_concepts_xlsx
    )
    generate_new_concepts_report(new_concepts_xlsx, new_concepts_html, 1500)

    log("------------------------------------------------------")
    print("✅ All reports generated successfully!")
    print(f"   Excel files: {output_dir}")
    print(f"   HTML files:  {assets_dir}")
    log("------------------------------------------------------")


if __name__ == "__main__":
    start = time.perf_counter()
    main()
    end = time.perf_counter()
    print(f"[Timing] Total runtime: {end - start:.2f} seconds")
