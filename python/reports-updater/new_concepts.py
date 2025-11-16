#!/usr/bin/env python3

import os
import pandas as pd
from tqdm import tqdm
from halo import Halo
from multiprocessing import Pool, cpu_count
from ci_utils import is_ci

def process_concept_group(args):
    """
    For a single concept group, return the first row (lowest effectiveTime)
    where active == 1, if any.
    """
    concept_id, group = args
    
    # Convert effectiveTime to int for sorting
    group['effectiveTime'] = group['effectiveTime'].astype(int)
    group['active'] = group['active'].astype(int)

    # Filter to active=1 rows only
    group_active = group[group['active'] == 1]
    if group_active.empty:
        return None  # No creation if never active

    # Get the earliest active row
    earliest = group_active.sort_values('effectiveTime').iloc[0]
    
    return {
        'conceptId': concept_id,
        'creationEffectiveTime': earliest['effectiveTime']
    }

def detect_new_concepts(concept_full_path, 
                        description_snapshot_path,
                        output_path):
    """
    Reads a SNOMED CT Full concept file and identifies new concepts by their
    earliest active row. Merges the concept FSN from the description snapshot,
    then writes them out to Excel.
    """
    spinner = Halo(text='Starting new concept detection...', spinner='dots', enabled=not is_ci())

    # ----------------------------------------------------------------------
    # 1. Check file existence
    # ----------------------------------------------------------------------
    if not os.path.exists(concept_full_path):
        raise FileNotFoundError(f"Concept file not found: {concept_full_path}")
    if not os.path.exists(description_snapshot_path):
        raise FileNotFoundError(f"Description file not found: {description_snapshot_path}")

    # ----------------------------------------------------------------------
    # 2. Load Full concept file
    # ----------------------------------------------------------------------
    spinner.start("Loading Full concept file...")
    concept_df = pd.read_csv(
        concept_full_path,
        sep='\t',
        dtype=str,
        on_bad_lines='skip'
    )
    spinner.succeed("Full concept file loaded.")

    # ----------------------------------------------------------------------
    # 2b. Exclude rows where effectiveTime == '20020131'
    # ----------------------------------------------------------------------
    spinner.start("Removing rows with effectiveTime=20020131...")
    initial_count = len(concept_df)
    concept_df = concept_df[concept_df['effectiveTime'] != '20020131']
    removed_count = initial_count - len(concept_df)
    spinner.succeed(f"Removed {removed_count} rows with effectiveTime=20020131.")

    # ----------------------------------------------------------------------
    # 3. Group by conceptId
    # ----------------------------------------------------------------------
    spinner.start("Grouping concepts by 'id'...")
    grouped_concepts = list(concept_df.groupby('id'))
    spinner.succeed(f"Concepts grouped. Total groups: {len(grouped_concepts)}")

    # ----------------------------------------------------------------------
    # 4. Detect earliest active row in parallel
    # ----------------------------------------------------------------------
    # Stop or succeed the spinner before starting TQDM to avoid console clashes
    spinner.succeed("Starting parallel processing of concept groups...")
    spinner.stop()

    # Prepare the list of (concept_id, group) tuples
    group_args = [(cid, grp) for cid, grp in grouped_concepts]

    with Pool(processes=cpu_count()) as pool:
        results = list(
            tqdm(
                pool.imap(process_concept_group, group_args),
                total=len(group_args),
                desc="Processing concepts in parallel",
                disable=is_ci()
            )
        )

    new_concept_records = [res for res in results if res is not None]
    new_concepts_df = pd.DataFrame(new_concept_records)

    spinner.start("Loading Snapshot description file...")
    desc_df = pd.read_csv(
        description_snapshot_path,
        sep='\t',
        dtype=str,
        on_bad_lines='skip',
        quoting=3
    )
    # Filter for FSNs: typeId=900000000000003001, active=1
    fsn_df = desc_df[
        (desc_df['typeId'] == '900000000000003001') & 
        (desc_df['active'] == '1')
    ][['conceptId', 'term']].drop_duplicates()
    fsn_df.rename(columns={'term': 'FSN'}, inplace=True)
    spinner.succeed("FSNs extracted from description snapshot.")

    spinner.start("Merging new concepts with FSN data...")
    new_concepts_df['conceptId'] = new_concepts_df['conceptId'].astype(int)
    fsn_df['conceptId'] = fsn_df['conceptId'].astype(int)

    final_df = pd.merge(
        new_concepts_df,
        fsn_df,
        how='left',
        on='conceptId'
    )
    spinner.succeed("Merge completed.")

    spinner.start("Finalizing and writing output...")
    final_df.sort_values('conceptId', inplace=True)
    final_df.to_excel(output_path, index=False, sheet_name='New Concepts')
    spinner.succeed(f"New concepts successfully written to {output_path}.")

def main():
    """
    Default main entry point for direct script usage.
    If you want to call detect_new_concepts from another script,
    just import this module and call detect_new_concepts(...) directly.
    """
    concept_full_path = (
        "/Users/alejandrolopezosornio/Downloads/"
        "SnomedCT_InternationalRF2_PRODUCTION_20250201T120000Z/Full/Terminology/"
        "sct2_Concept_Full_INT_20250201.txt"
    )
    description_snapshot_path = (
        "/Users/alejandrolopezosornio/Downloads/"
        "SnomedCT_InternationalRF2_PRODUCTION_20250201T120000Z/Snapshot/Terminology/"
        "sct2_Description_Snapshot-en_INT_20250201.txt"
    )
    output_path = "sct-changes-reports/list-new-concepts.xlsx"

    detect_new_concepts(
        concept_full_path, 
        description_snapshot_path,
        output_path
    )

if __name__ == '__main__':
    main()
