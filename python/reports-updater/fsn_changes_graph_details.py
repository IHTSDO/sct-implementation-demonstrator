#!/usr/bin/env python3

import pandas as pd
from halo import Halo
from ci_utils import is_ci
from report_json import build_report, turbo_palette, write_report


def generate_fsn_changes_report(
    fsn_changes_data_path: str,
    output_path: str,
    heads_size=500
):
    """
    Generate the compact JSON report of FSN changes, grouped by EffectiveTime
    and SemanticTag, from an Excel file containing FSN change data.
    The Angular app renders it as an interactive stacked bar chart.

    Parameters
    ----------
    fsn_changes_data_path : str
        Path to the Excel file containing FSN change data.
    output_path : str
        Path where the output JSON report should be written.
    heads_size : int
        Maximum number of detail rows kept per bar.
    """
    if not is_ci():
        print("Generating FSN Changes Report...")
    spinner = Halo(text="Starting FSN Changes Report Generation...", spinner="dots", enabled=not is_ci())

    spinner.start("Loading dataset...")
    try:
        # IDs stay text: as numbers, 18-digit SCTIDs would be rounded.
        df = pd.read_excel(fsn_changes_data_path, dtype={'ConceptId': str})
        spinner.succeed("Dataset loaded successfully.")
    except Exception as e:
        spinner.fail(f"Error loading dataset: {e}")
        return

    spinner.start("Extracting semantic tags and processing AfterEffectiveTime...")

    def extract_semantic_tag(fsn):
        if "(" in fsn and ")" in fsn:
            return fsn.split("(")[-1].split(")")[0]
        return "Unknown"

    df["SemanticTag"] = df["AfterFSN"].apply(extract_semantic_tag)
    df["AfterEffectiveTime"] = df["AfterEffectiveTime"].astype(str)
    df["AfterEffectiveTime"] = pd.Categorical(
        df["AfterEffectiveTime"],
        categories=sorted(df["AfterEffectiveTime"].unique()),
        ordered=True
    )
    spinner.succeed("Data processed.")

    spinner.start("Building report JSON...")
    series_count = df["SemanticTag"].nunique()
    report = build_report(
        df,
        x_col="AfterEffectiveTime",
        series_col="SemanticTag",
        columns=[("ConceptId", "ConceptId"), ("BeforeFSN", "Before FSN"), ("AfterFSN", "After FSN")],
        heads_size=heads_size,
        title="FSN Changes by Effective Time and Semantic Tag",
        x_title="Effective Time",
        y_title="Count",
        series_title="Semantic Tag",
        # Shuffled in a reproducible order so neighbouring tags get distinct colours.
        colorway=turbo_palette(series_count, shuffle_seed=0),
    )
    write_report(report, output_path)
    spinner.succeed(f"Report written: {output_path}")
