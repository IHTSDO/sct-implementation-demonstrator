#!/usr/bin/env python3
import pandas as pd
from halo import Halo
from ci_utils import is_ci
from report_json import PLOTLY_QUALITATIVE, build_report, write_report


def generate_inactivation_report(
    inactivation_data_path: str,
    output_path: str,
    heads_size=500
):
    """
    Generate the compact JSON report of concept inactivations from an Excel file
    (detect-inactivations.xlsx), grouped by EffectiveTime and Inactivation Reason.
    The Angular app renders it as an interactive stacked bar chart.

    Parameters
    ----------
    inactivation_data_path : str
        Path to the Excel file containing inactivation data.
    output_path : str
        Path where the output JSON report should be written.
    heads_size : int
        Maximum number of detail rows kept per bar.
    """
    if not is_ci():
        print("Generating Inactivation Report...")
    spinner = Halo(text="Starting Inactivation Report Generation...", spinner="dots", enabled=not is_ci())

    spinner.start("Loading dataset...")
    try:
        # IDs stay text: as numbers, 18-digit SCTIDs would be rounded.
        df = pd.read_excel(inactivation_data_path, dtype={'conceptId': str, 'inactivationReasonId': str})
        spinner.succeed("Dataset loaded successfully.")
    except Exception as e:
        spinner.fail(f"Error loading dataset: {e}")
        return

    spinner.start("Processing effective times, reasons and historical associations...")
    df["FSN"] = df["FSN"].astype(str)
    df["inactivationEffectiveTime"] = df["inactivationEffectiveTime"].astype(str)
    df["inactivationEffectiveTime"] = pd.Categorical(
        df["inactivationEffectiveTime"],
        categories=sorted(df["inactivationEffectiveTime"].unique()),
        ordered=True
    )
    df["inactivationReasonFSN"] = df["inactivationReasonFSN"].str.replace(r'\(.*\)', '', regex=True)
    df["historicalAssociations"] = df["historicalAssociations"].fillna('')
    df["historicalAssociations"] = df["historicalAssociations"].replace('null', '')
    # One association per line; the app renders the cell with white-space: pre-line.
    df["historicalAssociations"] = df["historicalAssociations"].str.replace('),', ')\n')
    spinner.succeed("Data processed.")

    spinner.start("Building report JSON...")
    # The inactivation reason is the series itself, so it is not repeated per row.
    report = build_report(
        df,
        x_col="inactivationEffectiveTime",
        series_col="inactivationReasonFSN",
        columns=[
            ("conceptId", "ConceptId"),
            ("FSN", "FSN"),
            ("historicalAssociations", "Historical Associations"),
        ],
        heads_size=heads_size,
        title="Inactivation Reasons by Effective Time",
        x_title="Effective Time",
        y_title="Count",
        series_title="Inactivation Reason",
        colorway=PLOTLY_QUALITATIVE,
    )
    write_report(report, output_path)
    spinner.succeed(f"Report written: {output_path}")


if __name__ == "__main__":
    generate_inactivation_report(
        inactivation_data_path="sct-changes-reports/detect-inactivations.xlsx",
        output_path="sct-changes-reports/detect_inactivations_by_reason.json"
    )
