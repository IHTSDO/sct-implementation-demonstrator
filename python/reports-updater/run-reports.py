#!/usr/bin/env python3
import os
import time
from tempfile import TemporaryDirectory

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
from ci_utils import log

def main():
    # ------------------------------------------------------------------
    # 1. Descargar y extraer release SNOMED (vía syndication feed)
    #    en un directorio temporal fuera del repo para evitar commits accidentales
    # ------------------------------------------------------------------
    log("------------------------------------------------------")
    log("🔽 Downloading and extracting latest SNOMED International release...")
    log("------------------------------------------------------")

    with TemporaryDirectory(prefix="snomed-release-") as temp_dir:
        data_dir = os.path.join(temp_dir, "data")
        os.makedirs(data_dir, exist_ok=True)

        root_folder = download_latest_international(data_dir)
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
