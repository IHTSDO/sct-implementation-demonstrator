#!/usr/bin/env python3
"""
Sanity checks for the generated SNOMED report HTML files.

These reports are 20-36 MB of generated HTML, so a broken one is easy to miss:
the generator exits 0, CI stays green, and a page whose per-segment details no
longer load gets committed and deployed. That already happened once, when an
unpinned plotly >= 6 started emitting base64 typed arrays. Run this before
committing anything.

Usage:
    python validate_reports.py [report.html ...]

With no arguments it checks the three reports in src/assets/reports/.
Exits non-zero (and says why) if any check fails.
"""
import json
import os
import re
import sys

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "src", "assets", "reports")

DEFAULT_REPORTS = [
    "detect_inactivations_by_reason.html",
    "fsn_changes_with_details.html",
    "new_concepts_by_semantic_tag.html",
]

# The reports are tens of MB; anything this small means the pipeline produced a
# stub rather than a real report.
MIN_SIZE_BYTES = 1_000_000

DATA_LINE = re.compile(r"^\s*var data = (\{.*\});\s*$", re.MULTILINE)


def check_report(path):
    """Return a list of problems found in one report (empty means it is fine)."""
    problems = []
    name = os.path.basename(path)

    if not os.path.isfile(path):
        return [f"{name}: file not found at {path}"]

    size = os.path.getsize(path)
    if size < MIN_SIZE_BYTES:
        problems.append(f"{name}: only {size:,} bytes, expected at least {MIN_SIZE_BYTES:,}")

    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    if "cdn.plot.ly" not in html:
        problems.append(f"{name}: no plotly.js script tag")
    elif "plotly-latest" in html:
        # A dead alias: it still resolves to v1.58.5 (July 2021) and never moves.
        problems.append(
            f"{name}: loads plotly-latest.min.js, which is frozen at plotly.js "
            "v1.58.5. Pin an explicit version in the report template."
        )

    # plotly >= 6 emits {"dtype": ..., "bdata": ...} typed arrays, which the
    # plotly.js version this template loads cannot read.
    if '"bdata"' in html:
        problems.append(
            f"{name}: contains base64 typed arrays (\"bdata\") instead of plain "
            "JSON arrays. Check the installed plotly version against "
            "requirements.txt, and that convert_numpy_types still decodes them."
        )

    match = DATA_LINE.search(html)
    if not match:
        problems.append(f"{name}: could not find the embedded 'var data = ...;' payload")
        return problems

    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        problems.append(f"{name}: embedded chart JSON is not valid JSON ({exc})")
        return problems

    traces = data.get("data")
    if not isinstance(traces, list) or not traces:
        problems.append(f"{name}: chart JSON has no traces")
        return problems

    # The template's year buttons and click handler do data.data[0].x.map(...)
    # and read customdata off the clicked point, so these must be plain arrays.
    for index, trace in enumerate(traces):
        for axis in ("x", "y"):
            values = trace.get(axis)
            if not isinstance(values, list):
                problems.append(
                    f"{name}: trace {index} has non-array '{axis}' "
                    f"({type(values).__name__}); the details panel will not load"
                )
        if "customdata" in trace and not isinstance(trace["customdata"], list):
            problems.append(f"{name}: trace {index} has non-array 'customdata'")

    if not any("customdata" in trace for trace in traces):
        problems.append(f"{name}: no trace carries customdata, so no segment details to show")

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
        for problem in all_problems:
            print(f"  - {problem}")
        return 1

    print("")
    print(f"All {len(paths)} reports passed validation.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
