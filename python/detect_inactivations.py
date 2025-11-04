#!/usr/bin/env python3
import pandas as pd
import os
from tqdm import tqdm
from halo import Halo
import multiprocessing
from multiprocessing import Pool

def process_concept_group(args):
    """Process a single concept group to detect inactivations."""
    concept_id, group = args
    group = group[['id', 'effectiveTime', 'active']].copy()
    group['prev_active'] = group['active'].shift(1)
    inactivated_rows = group[(group['active'] == 0) & (group['prev_active'] == 1)]

    if not inactivated_rows.empty:
        first_inactivate_row = inactivated_rows.iloc[0]
        return {
            'conceptId': concept_id,
            'inactivationEffectiveTime': first_inactivate_row['effectiveTime']
        }
    return None

def detect_inactivations(concept_full_path, 
                         description_snapshot_path, 
                         refset_inactivation_path,
                         refset_historical_associations_path,
                         output_path):
    """
    Detects inactivations from a SNOMED CT 'Full' concept file (RF2), merges them 
    with their inactivation reasons from the Concept Inactivation Indicator Reference Set,
    and writes them out with conceptId, FSN, the effectiveTime when the concept was 
    inactivated, and the inactivation reason to an Excel (.xlsx) file.
    """
    print("Detecting inactivations...")
    spinner = Halo(text='Starting inactivation detection process...', spinner='dots')

    # Check if files exist
    if not os.path.exists(concept_full_path):
        raise FileNotFoundError(f"Concept file not found: {concept_full_path}")
    if not os.path.exists(description_snapshot_path):
        raise FileNotFoundError(f"Description file not found: {description_snapshot_path}")
    if not os.path.exists(refset_inactivation_path):
        raise FileNotFoundError(f"Inactivation reference set file not found: {refset_inactivation_path}")

    # ----------------------------------------------------------------------
    # 1. Load Full concept file into a pandas DataFrame
    # ----------------------------------------------------------------------
    spinner.start("Loading Full concept file...")
    concept_df = pd.read_csv(
        concept_full_path,
        sep='\t',
        dtype=str,
        on_bad_lines='skip'
    )
    concept_df['active'] = concept_df['active'].astype(int, errors='ignore')
    concept_df.sort_values(by=['id', 'effectiveTime'], inplace=True)
    spinner.succeed("Loaded and sorted Full concept file.")

    # ----------------------------------------------------------------------
    # 2. Detect inactivations (single-process)
    # ----------------------------------------------------------------------
    spinner.start("Grouping concepts for inactivation detection...")
    grouped_concepts = list(concept_df.groupby('id'))
    spinner.succeed("Concepts grouped.")

    # Convert grouped DataFrame objects to argument tuples
    arg_list = [(concept_id, group) for concept_id, group in grouped_concepts]

    results = []
    with Pool(processes=multiprocessing.cpu_count()) as pool:
        # pool.imap(...) returns an iterator lazily
        # We'll wrap that in tqdm so we get a progress bar
        for res in tqdm(pool.imap(process_concept_group, arg_list),
                        total=len(arg_list),
                        desc="Processing concepts in parallel"):
            if res is not None:
                results.append(res)

    # Convert to DataFrame
    inactivation_df = pd.DataFrame(results)

    # ----------------------------------------------------------------------
    # 3. Load the Snapshot description file and extract FSNs
    # ----------------------------------------------------------------------
    spinner.start("Loading Snapshot description file...")
    desc_df = pd.read_csv(
        description_snapshot_path,
        sep='\t',
        dtype=str,
        on_bad_lines='skip',
        quoting=3
    )
    # FSN filter
    fsn_df = desc_df[
        (desc_df['typeId'] == '900000000000003001') & 
        (desc_df['active'] == '1')
    ][['conceptId', 'term']].drop_duplicates()
    fsn_df.rename(columns={'term': 'FSN'}, inplace=True)
    spinner.succeed("Snapshot description file loaded (FSNs extracted).")

    # ----------------------------------------------------------------------
    # 4. Merge the inactivation info with the FSN
    # ----------------------------------------------------------------------
    spinner.start("Merging inactivation data with concept FSNs...")
    final_df = pd.merge(
        inactivation_df, fsn_df,
        how='left',
        on='conceptId'
    )
    spinner.succeed("Inactivation data merged with concept FSNs.")

    # ----------------------------------------------------------------------
    # 5. Load the Concept Inactivation Indicator Reference Set
    # ----------------------------------------------------------------------
    spinner.start("Loading Inactivation Indicator Reference Set...")
    reason_df = pd.read_csv(
        refset_inactivation_path,
        sep='\t',
        dtype=str,
        on_bad_lines='skip'
    )
    # Only rows from the refset '900000000000489007'
    reason_df = reason_df[reason_df['refsetId'] == '900000000000489007'].copy()

    # Rename to keep things clear
    reason_df.rename(
        columns={
            'referencedComponentId': 'conceptId',
            'valueId': 'inactivationReasonId'
        },
        inplace=True
    )
    spinner.succeed("Inactivation Indicator Reference Set loaded.")

    # ----------------------------------------------------------------------
    # 6. Merge inactivation records with inactivation reason
    # ----------------------------------------------------------------------
    spinner.start("Deriving correct reason row (<= inactivation date) without merge_asof...")

    final_df['inactivationEffectiveTime'] = final_df['inactivationEffectiveTime'].astype(int)
    reason_df['effectiveTime'] = reason_df['effectiveTime'].astype(int)
    final_df['conceptId'] = final_df['conceptId'].astype(int)
    reason_df['conceptId'] = reason_df['conceptId'].astype(int)

    final_df.sort_values(by=['conceptId','inactivationEffectiveTime'], inplace=True)
    reason_df.sort_values(by=['conceptId','effectiveTime'], inplace=True)

    merged_all = pd.merge(
        final_df,
        reason_df[['conceptId', 'effectiveTime', 'inactivationReasonId']],
        on='conceptId',
        how='left'
    )

    merged_all = merged_all[
        merged_all['effectiveTime'].isna() |
        (merged_all['effectiveTime'] <= merged_all['inactivationEffectiveTime'])
    ]

    merged_all.sort_values(
        by=['conceptId','inactivationEffectiveTime','effectiveTime'],
        inplace=True
    )

    grouped = merged_all.groupby(
        ['conceptId', 'inactivationEffectiveTime'],
        as_index=False,
        sort=False
    ).last()  # 'last' picks largest effectiveTime <= inactivation date
    merged_df = grouped.copy()

    spinner.succeed("Selected the valid inactivation reason rows (<= inactivation date).")

    # Fill in missing reason
    merged_df['inactivationReasonId'] = merged_df['inactivationReasonId'].fillna('0')
    merged_df['inactivationReasonFSN'] = 'Not specified'

    # ----------------------------------------------------------------------
    # 7. Get FSN for the inactivation reason
    # ----------------------------------------------------------------------
    spinner.start("Retrieving FSN for the inactivation reason...")
    reason_fsn_df = desc_df[
        (desc_df['typeId'] == '900000000000003001') & 
        (desc_df['active'] == '1')
    ][['conceptId','term']].drop_duplicates()

    reason_fsn_df.rename(
        columns={
            'conceptId': 'reasonId',
            'term': 'inactivationReasonFSN'
        },
        inplace=True
    )

    merged_df = pd.merge(
        merged_df,
        reason_fsn_df,
        how='left',
        left_on='inactivationReasonId',
        right_on='reasonId'
    )
    spinner.succeed("FSN for inactivation reason retrieved.")

    merged_df['inactivationReasonFSN'] = merged_df['inactivationReasonFSN_y'].fillna(
        merged_df['inactivationReasonFSN_x']
    )
    merged_df.drop(['inactivationReasonFSN_x', 'inactivationReasonFSN_y'], axis=1, inplace=True)

    # ----------------------------------------------------------------------
    # 8. Load & merge Historical Associations
    # ----------------------------------------------------------------------
    spinner.start("Loading Historical Associations (Full) reference set...")
    hist_df = pd.read_csv(
        refset_historical_associations_path,
        sep='\t',
        dtype=str,
        on_bad_lines='skip'
    )

    HISTORICAL_REFSETS = [
        '900000000000531004',  # REFERS TO
        '900000000000530003',  # ALTERNATIVE
        '900000000000529008',  # SIMILAR TO
        '900000000000528000',  # WAS A
        '900000000000527005',  # SAME AS
        '900000000000526001',  # REPLACED BY
        '900000000000525002',  # MOVED FROM
        '900000000000524003',  # MOVED TO
        '900000000000523009',  # POSSIBLY EQUIVALENT TO
        '900000000000522004',  # Historical association reference set (parent)
        '1186924009',          # PARTIALLY EQUIVALENT TO
        '1186921001',          # POSSIBLY REPLACED BY
    ]

    hist_df = hist_df[hist_df['refsetId'].isin(HISTORICAL_REFSETS)]

    hist_df.rename(columns={
        'refsetId': 'historicalRefsetId',
        'referencedComponentId': 'conceptId',
        'targetComponentId': 'targetConceptId'
    }, inplace=True)

    hist_df['effectiveTime'] = hist_df['effectiveTime'].astype(int)
    hist_df['active'] = hist_df['active'].fillna('0').astype(int)
    hist_df['historicalRefsetId'] = hist_df['historicalRefsetId'].astype(int, errors='ignore')
    hist_df['conceptId'] = hist_df['conceptId'].astype(int, errors='ignore')
    hist_df['targetConceptId'] = hist_df['targetConceptId'].astype(int, errors='ignore')

    hist_df = hist_df[hist_df['active'] == 1]

    hist_merge = pd.merge(
        merged_df[['conceptId','inactivationEffectiveTime']],
        hist_df[['conceptId','historicalRefsetId', 'targetConceptId','effectiveTime']],
        on='conceptId',
        how='left'
    )

    hist_merge = hist_merge[
        hist_merge['effectiveTime'].isna() |
        (hist_merge['effectiveTime'] <= hist_merge['inactivationEffectiveTime'])
    ]

    hist_merge.sort_values(
        by=['conceptId','inactivationEffectiveTime','effectiveTime'],
        inplace=True
    )

    hist_fsn_df = desc_df[
        (desc_df['typeId'] == '900000000000003001') &
        (desc_df['active'] == '1')
    ][['conceptId','term']].drop_duplicates()

    hist_fsn_df['conceptId'] = hist_fsn_df['conceptId'].astype(int)

    hist_merge = pd.merge(
        hist_merge,
        hist_fsn_df,
        left_on='historicalRefsetId',
        right_on='conceptId',
        how='left',
        suffixes=('', '_historical')
    )

    hist_merge = pd.merge(
        hist_merge,
        hist_fsn_df,
        left_on='targetConceptId',
        right_on='conceptId',
        how='left',
        suffixes=('', '_target')
    )
    # remove the parent text if present
    hist_merge['term'] = hist_merge['term'].str.replace(
        'association reference set (foundation metadata concept)', ''
    )

    hist_merge['term'] = hist_merge['term'] + ' -> ' + hist_merge['term_target']
    hist_merge.rename(columns={'conceptId_x': 'conceptId'}, inplace=True)

    grouped_hist = hist_merge.groupby(
        ['conceptId','inactivationEffectiveTime'],
        as_index=False
    ).agg({'term': list})

    spinner.succeed("Historical associations loaded & filtered.")

    spinner.start("Building comma-separated FSNs for associated concepts...")
    def join_terms(term_list):
        if not isinstance(term_list, list):
            return ""
        term_strings = [str(item) for item in term_list if pd.notna(item)]
        return ', '.join(term_strings)

    grouped_hist['historicalAssociations'] = grouped_hist['term'].apply(join_terms)

    spinner.start("Adding historical associations to the final DataFrame...")
    merged_df = pd.merge(
        merged_df,
        grouped_hist,
        on=['conceptId','inactivationEffectiveTime'],
        how='left'
    )
    merged_df['historicalAssociations'] = merged_df['historicalAssociations'].fillna('')
    spinner.succeed("Historical associations merged into main DataFrame.")

    # ----------------------------------------------------------------------
    # Final columns & output
    # ----------------------------------------------------------------------
    spinner.start("Finalizing output data...")
    merged_df = merged_df[[
        'conceptId', 
        'FSN', 
        'inactivationEffectiveTime', 
        'inactivationReasonId', 
        'inactivationReasonFSN',
        'historicalAssociations'
    ]]
    merged_df.sort_values('conceptId', inplace=True)
    spinner.succeed("Output data finalized.")

    spinner.start(f"Writing results to: {output_path}")
    merged_df.to_excel(output_path, index=False, sheet_name='Inactivations')
    spinner.succeed(f"Results successfully written to {output_path}")


if __name__ == '__main__':
    concept_full_path = '/Users/alejandrolopezosornio/Downloads/SnomedCT_InternationalRF2_PRODUCTION_20250201T120000Z/Full/Terminology/sct2_Concept_Full_INT_20250201.txt'
    description_snapshot_path = '/Users/alejandrolopezosornio/Downloads/SnomedCT_InternationalRF2_PRODUCTION_20250201T120000Z/Snapshot/Terminology/sct2_Description_Snapshot-en_INT_20250201.txt'
    
    refset_inactivation_path = '/Users/alejandrolopezosornio/Downloads/SnomedCT_InternationalRF2_PRODUCTION_20250201T120000Z/Full/Refset/Content/der2_cRefset_AttributeValueFull_INT_20250201.txt'
    refset_historical_associations_path = '/Users/alejandrolopezosornio/Downloads/SnomedCT_InternationalRF2_PRODUCTION_20250201T120000Z/Full/Refset/Content/der2_cRefset_AssociationFull_INT_20250201.txt'

    output_path = 'sct-changes-reports/detect-inactivations.xlsx'

    detect_inactivations(
        concept_full_path, 
        description_snapshot_path, 
        refset_inactivation_path,
        refset_historical_associations_path,
        output_path
    )
