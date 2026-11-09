#!/usr/bin/env python3
"""
Compact JSON payload shared by the three SNOMED change reports.

The reports used to be self-contained Plotly HTML pages (20-37 MB each) whose
per-bar details were stored as a list of dicts, repeating every key and the
values that are constant within a bar (the effective time and the series
name). The Angular app now renders the chart itself, so the generators only
emit the data, in a columnar shape:

{
  "version": 1,
  "title": "...", "xTitle": "...", "yTitle": "...", "seriesTitle": "...",
  "headsSize": 1500,
  "colorway": ["rgb(...)", ...],
  "columns": [{"key": "conceptId", "label": "ConceptId"}, ...],
  "x": ["20020131", ...],
  "series": [
    {"name": "disorder", "y": [12, 0, ...], "rows": [[[id, fsn], ...], [], ...]}
  ]
}

series[i].rows[j] holds the first `headsSize` detail rows of the bar at x[j],
each row being the values of `columns` in order. The bar total is y[j]; the
stack total of x[j] is the sum of y[j] over all series.
"""
import json

import numpy as np
from matplotlib import cm

from ci_utils import convert_numpy_types

FORMAT_VERSION = 1

# plotly.express.colors.qualitative.Plotly, inlined so the generators no longer
# depend on plotly.
PLOTLY_QUALITATIVE = [
    "#636EFA", "#EF553B", "#00CC96", "#AB63FA", "#FFA15A",
    "#19D3F3", "#FF6692", "#B6E880", "#FF97FF", "#FECB52",
]


def turbo_palette(count, shuffle_seed=None):
    """Evenly spaced colours from matplotlib's turbo map, optionally shuffled."""
    palette = [
        "rgb({},{},{})".format(int(r * 255), int(g * 255), int(b * 255))
        for r, g, b, _ in (cm.turbo(i) for i in np.linspace(0, 1, count))
    ]
    if shuffle_seed is not None:
        np.random.seed(shuffle_seed)
        np.random.shuffle(palette)
    return palette


def build_report(df, x_col, series_col, columns, heads_size, *,
                 title, x_title, y_title, series_title, colorway):
    """
    Group `df` by (x_col, series_col) and return the compact report dict.

    `x_col` must be an ordered categorical so the x axis keeps its order.
    `columns` is a list of (dataframe column, table header label) pairs.
    """
    keys = [key for key, _ in columns]
    grouped = df.groupby([x_col, series_col], observed=False).size().unstack(fill_value=0)
    x_values = [str(x) for x in grouped.index.tolist()]

    # One pass over the rows instead of one boolean filter per bar. Values are
    # emitted as strings: SCTIDs reach 18 digits, beyond JavaScript's safe
    # integer range, and blanks must not become NaN (invalid JSON).
    detail_rows = {}
    for (x, name), group in df.groupby([x_col, series_col], observed=True, sort=False):
        head = group[keys].head(heads_size).astype(object)
        head = head.where(head.notna(), "").astype(str)
        detail_rows[(str(x), name)] = head.values.tolist()

    series = [
        {
            "name": name,
            "y": grouped[name].tolist(),
            "rows": [detail_rows.get((x, name), []) for x in x_values],
        }
        for name in grouped.columns
    ]

    return convert_numpy_types({
        "version": FORMAT_VERSION,
        "title": title,
        "xTitle": x_title,
        "yTitle": y_title,
        "seriesTitle": series_title,
        "headsSize": heads_size,
        "colorway": colorway,
        "columns": [{"key": key, "label": label} for key, label in columns],
        "x": x_values,
        "series": series,
    })


def write_report(report, output_path):
    """Write the report as minified UTF-8 JSON."""
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, separators=(",", ":"))
