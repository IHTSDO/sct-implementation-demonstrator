#!/usr/bin/env python3

import pandas as pd
from halo import Halo
from ci_utils import is_ci
from report_json import build_report, turbo_palette, write_report


def generate_new_concepts_report(
    input_file="sct-changes-reports/list-new-concepts.xlsx",
    output_json="sct-changes-reports/new_concepts_by_semantic_tag.json",
    heads_size=500
):
    """
    Generate the compact JSON report of new concepts by creation date
    (creationEffectiveTime) and semantic tag (extracted from the FSN).
    The Angular app renders it as an interactive stacked bar chart.

    Parameters
    ----------
    input_file : str
        Path to the Excel file containing new concept data (with columns like 'conceptId',
        'creationEffectiveTime', 'FSN').
    output_json : str
        Path to the output JSON file.
    heads_size : int
        Maximum number of detail rows kept per bar. Defaults to 500.
    """
    if not is_ci():
        print("Generating new concepts report...")
    spinner = Halo(text='Starting new concept report generation...', spinner='dots', enabled=not is_ci())

    spinner.start("Loading the dataset...")
    # IDs stay text: as numbers, 18-digit SCTIDs would be rounded.
    df = pd.read_excel(input_file, dtype={'conceptId': str})
    df["FSN"] = df["FSN"].astype(str)
    spinner.succeed("Dataset loaded successfully.")

    spinner.start("Processing creationEffectiveTime and semantic tags...")
    df["creationEffectiveTime"] = df["creationEffectiveTime"].astype(str)
    df["creationEffectiveTime"] = pd.Categorical(
        df["creationEffectiveTime"],
        categories=sorted(df["creationEffectiveTime"].unique()),
        ordered=True
    )
    df["semanticTag"] = df["FSN"].str.extract(r'\(([^()]*)\)$')
    # remove rows where semanticTag is NaN (meaning no parentheses found)
    df.dropna(subset=["semanticTag"], inplace=True)
    spinner.succeed("Data processed.")

    spinner.start("Building report JSON...")
    series_count = df["semanticTag"].nunique()
    report = build_report(
        df,
        x_col="creationEffectiveTime",
        series_col="semanticTag",
        columns=[("conceptId", "ConceptId"), ("FSN", "FSN")],
        heads_size=heads_size,
        title="New Concepts by Creation Date and Semantic Tag",
        x_title="Creation Effective Time",
        y_title="Count of New Concepts",
        series_title="Semantic Tag",
        colorway=turbo_palette(series_count),
    )
    write_report(report, output_json)
    spinner.succeed(f"Report written: {output_json}")


if __name__ == "__main__":
    generate_new_concepts_report()
