#!/usr/bin/env python3
"""
Sanity checks for the generated SNOMED report JSON files.

The generator can exit 0 while producing a report the app cannot render (a
stub, a shape change, NaN in the payload), and CI would stay green and deploy
it. Run this before committing anything. The format is described in
report_json.py.

Usage:
    python validate_reports.py [report.json ...]

With no arguments it checks the three reports in src/assets/reports/.
Exits non-zero (and says why) if any check fails.
"""
import json
import os
import sys

from report_json import FORMAT_VERSION

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "src", "assets", "reports")

DEFAULT_REPORTS = [
    "detect_inactivations_by_reason.json",
    "fsn_changes_with_details.json",
    "new_concepts_by_semantic_tag.json",
]

# The reports are several MB; anything this small means the pipeline produced a
# stub rather than a real report.
MIN_SIZE_BYTES = 1_000_000


# Verhoeff check digit tables, used by SNOMED CT identifiers.
_VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
_VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

# Detail columns that hold SNOMED CT concept identifiers.
SCTID_COLUMNS = {"conceptId", "ConceptId"}


def is_valid_sctid(value):
    """True if `value` is a 6-18 digit string with a valid Verhoeff check digit.

    A rounded ID (an 18-digit SCTID that went through a float, for instance
    900000000000484002 -> 900000000000483968) fails the check digit."""
    if not isinstance(value, str) or not value.isdigit() or not 6 <= len(value) <= 18:
        return False
    check = 0
    for i, digit in enumerate(reversed(value)):
        check = _VERHOEFF_D[check][_VERHOEFF_P[i % 8][int(digit)]]
    return check == 0


def _reject_constant(value):
    raise ValueError(f"non-standard JSON constant {value}")


def check_report(path):
    """Return a list of problems found in one report (empty means it is fine)."""
    problems = []
    name = os.path.basename(path)

    if not os.path.isfile(path):
        return [f"{name}: file not found at {path}"]

    size = os.path.getsize(path)
    if size < MIN_SIZE_BYTES:
        problems.append(f"{name}: only {size:,} bytes, expected at least {MIN_SIZE_BYTES:,}")

    try:
        with open(path, "r", encoding="utf-8") as f:
            # NaN / Infinity are accepted by Python but rejected by JSON.parse.
            report = json.load(f, parse_constant=_reject_constant)
    except (json.JSONDecodeError, ValueError) as exc:
        return problems + [f"{name}: not valid JSON ({exc})"]

    if report.get("version") != FORMAT_VERSION:
        problems.append(f"{name}: version {report.get('version')!r}, expected {FORMAT_VERSION}")

    x_values = report.get("x")
    columns = report.get("columns")
    series = report.get("series")
    if not isinstance(x_values, list) or not x_values:
        problems.append(f"{name}: 'x' must be a non-empty array")
        return problems
    if not isinstance(columns, list) or not columns:
        problems.append(f"{name}: 'columns' must be a non-empty array")
        return problems
    if not isinstance(series, list) or not series:
        problems.append(f"{name}: 'series' must be a non-empty array")
        return problems

    heads_size = report.get("headsSize")
    sctid_indexes = [i for i, column in enumerate(columns) if column.get("key") in SCTID_COLUMNS]
    invalid_ids = []
    total_rows = 0
    for index, item in enumerate(series):
        label = f"{name}: series {index} ({item.get('name')!r})"
        y_values, rows = item.get("y"), item.get("rows")
        if not isinstance(y_values, list) or len(y_values) != len(x_values):
            problems.append(f"{label}: 'y' must have one value per x")
            continue
        if not isinstance(rows, list) or len(rows) != len(x_values):
            problems.append(f"{label}: 'rows' must have one list per x")
            continue
        for x, count, bar_rows in zip(x_values, y_values, rows):
            expected = min(count, heads_size) if isinstance(heads_size, int) else count
            if len(bar_rows) != expected:
                problems.append(f"{label} at {x}: {len(bar_rows)} detail rows, expected {expected}")
                break
            if bar_rows and len(bar_rows[0]) != len(columns):
                problems.append(f"{label} at {x}: rows have {len(bar_rows[0])} cells, expected {len(columns)}")
                break
            total_rows += len(bar_rows)
            for row in bar_rows:
                invalid_ids.extend(row[i] for i in sctid_indexes if not is_valid_sctid(row[i]))

    if invalid_ids:
        problems.append(
            f"{name}: {len(invalid_ids)} concept IDs fail the SCTID check digit, e.g. "
            f"{', '.join(map(repr, invalid_ids[:3]))}. IDs must stay text from RF2 to "
            "the JSON; an 18-digit SCTID stored as a number gets rounded."
        )

    if total_rows == 0:
        problems.append(f"{name}: no detail rows at all, so no segment details to show")

    return problems


def main(argv):
    paths = argv[1:] or [os.path.join(ASSETS_DIR, name) for name in DEFAULT_REPORTS]

    all_problems = []
    for path in paths:
        problems = check_report(path)
        if problems:
            all_problems.extend(problems)
        else:
            size = os.path.getsize(path)
            print(f"OK   {os.path.basename(path)} ({size / 1_048_576:.1f} MB)")

    if all_problems:
        print("")
        print("Report validation FAILED:")
        for problem in all_problems[:50]:
            print(f"  - {problem}")
        return 1

    print("")
    print(f"All {len(paths)} reports passed validation.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
