#!/usr/bin/env python3

import csv
from collections import defaultdict
import pandas as pd
from halo import Halo
from ci_utils import is_ci

FSN_TYPE_ID = "900000000000003001"

def load_active_concepts(concept_snapshot_file):
    """
    Reads the Concept Snapshot file and returns a set of active conceptIds.
    """
    active_concepts = set()

    with open(concept_snapshot_file, "r", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        header = next(reader)

        # Safely find column indices
        conceptId_idx = header.index("id")
        active_idx = header.index("active")

        for row in reader:
            if len(row) < 2:
                continue  # Skip malformed rows
            
            conceptId = row[conceptId_idx]
            active = row[active_idx]

            if active == "1":  # Include only active concepts
                active_concepts.add(conceptId)

    return active_concepts


def load_full_description_history(full_description_file):
    """
    Reads a FULL SNOMED CT RF2 description file and returns a dict:
      {
        conceptId: [
          {
            "descriptionId": str,
            "effectiveTime": str,
            "active": str ('0' or '1'),
            "term": str,
            "typeId": str
          },
          ...
        ],
        ...
      }

    We do NOT filter by active or typeId here. We'll keep all rows, then
    filter them later for FSNs only.
    """
    concept_history = defaultdict(list)

    with open(full_description_file, "r", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        header = next(reader)

        # Safely find column indices
        id_idx               = header.index("id")
        effectiveTime_idx    = header.index("effectiveTime")
        active_idx           = header.index("active")
        conceptId_idx        = header.index("conceptId")
        typeId_idx           = header.index("typeId")
        term_idx             = header.index("term")

        for row in reader:
            # Basic sanity check for minimum columns
            if len(row) < 9:
                continue  # skip malformed lines

            descriptionId = row[id_idx]
            conceptId     = row[conceptId_idx]
            typeId        = row[typeId_idx]
            effectiveTime = row[effectiveTime_idx]
            active        = row[active_idx]
            term          = row[term_idx]

            record = {
                "descriptionId": descriptionId,
                "effectiveTime": effectiveTime,
                "active": active,
                "term": term,
                "typeId": typeId
            }
            concept_history[conceptId].append(record)

    return concept_history


def detect_fsn_changes(
    full_description_file: str,
    concept_snapshot_file: str,
    output_path: str
):
    """
    Detects FSN (Fully Specified Name) changes for active concepts by comparing
    consecutive FSN states over time in a FULL description file, then exports
    those changes to Excel.

    Parameters
    ----------
    full_description_file : str
        Path to the FULL sct2_Description_Full-en_INT file.
    concept_snapshot_file : str
        Path to the Snapshot sct2_Concept_Snapshot_INT file (active concepts).
    output_path : str
        Path to the resulting .xlsx file for FSN changes.
    """
    if not is_ci():
        print("Detecting FSN changes...")
    spinner = Halo(text='Starting FSN changes detection process...', spinner='dots', enabled=not is_ci())

    # Load active concepts
    spinner.start("Loading active concepts...")
    active_concepts = load_active_concepts(concept_snapshot_file)
    spinner.succeed(f"Loaded {len(active_concepts)} active concepts.")

    # Read the full description file into memory
    spinner.start("Loading full description history...")
    concept_history = load_full_description_history(full_description_file)
    spinner.succeed(f"Loaded {len(concept_history)} concepts with full description history.")

    # Filter and process concepts with FSN changes
    changed_concepts = {}
    spinner.start("Detecting FSN changes...")
    for conceptId, records in concept_history.items():
        if conceptId not in active_concepts:
            continue

        # Filter to FSN rows only (typeId == FSN_TYPE_ID)
        fsn_records = [r for r in records if r["typeId"] == FSN_TYPE_ID]
        if not fsn_records:
            continue

        # Among those, consider only rows that are active=1
        active_fsn_records = [r for r in fsn_records if r["active"] == "1"]
        if not active_fsn_records:
            continue

        # Sort active FSN records by effectiveTime (ascending)
        active_fsn_records.sort(key=lambda x: x["effectiveTime"])

        # Deduplicate snapshots by FSN text (term)
        snapshots = []
        last_term = None
        for r in active_fsn_records:
            if r["term"] != last_term:
                snapshots.append(
                    (r["effectiveTime"], r["descriptionId"], r["term"])
                )
                last_term = r["term"]

        if len(snapshots) > 1:
            changed_concepts[conceptId] = snapshots
    spinner.succeed(f"Detected {len(changed_concepts)} concepts with FSN changes.")

    # Print the results and export
    if not changed_concepts:
        print("No FSN changes found across the full history.")
    else:
        spinner.start("Collecting FSN changes...")
        data = []
        for conceptId, snapshots in sorted(changed_concepts.items(), key=lambda x: x[0]):
            for i in range(len(snapshots) - 1):
                before = snapshots[i]
                after = snapshots[i + 1]
                data.append([
                    conceptId,
                    before[0],  # BeforeEffectiveTime
                    before[2],  # BeforeFSN
                    after[0],   # AfterEffectiveTime
                    after[2]    # AfterFSN
                ])

        df = pd.DataFrame(
            data,
            columns=["ConceptId", "BeforeEffectiveTime", "BeforeFSN", "AfterEffectiveTime", "AfterFSN"]
        )
        df.to_excel(output_path, index=False)
        spinner.succeed(f"FSN changes have been exported to {output_path}")


def main():
    """
    Default 'main' function with hardcoded file paths for direct script usage.
    If you want to run from a runner script with different paths,
    just import and call detect_fsn_changes(...) directly.
    """

    full_description_file = (
        "/Users/alejandrolopezosornio/Downloads/"
        "SnomedCT_InternationalRF2_PRODUCTION_20250201T120000Z/Full/Terminology/"
        "sct2_Description_Full-en_INT_20250201.txt"
    )
    concept_snapshot_file = (
        "/Users/alejandrolopezosornio/Downloads/"
        "SnomedCT_InternationalRF2_PRODUCTION_20250201T120000Z/Snapshot/Terminology/"
        "sct2_Concept_Snapshot_INT_20250201.txt"
    )
    output_path = "sct-changes-reports/fsn-changes.xlsx"

    detect_fsn_changes(full_description_file, concept_snapshot_file, output_path)


if __name__ == "__main__":
    main()
