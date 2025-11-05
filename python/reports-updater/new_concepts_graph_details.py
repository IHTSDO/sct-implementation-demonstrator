#!/usr/bin/env python3

import pandas as pd
import plotly.graph_objects as go
import plotly.io as pio
from halo import Halo
import numpy as np
from matplotlib import cm
from tqdm import tqdm

def generate_new_concepts_report(
    input_file="sct-changes-reports/list-new-concepts.xlsx",
    output_html="sct-changes-reports/new_concepts_by_semantic_tag.html",
    heads_size=500
):
    """
    Generate an interactive Plotly HTML chart showing new concepts by creation date
    (creationEffectiveTime) and semantic tag (extracted from the FSN).
    
    Parameters
    ----------
    input_file : str
        Path to the Excel file containing new concept data (with columns like 'conceptId', 
        'creationEffectiveTime', 'FSN').
    output_html : str
        Path to the output HTML file where the interactive chart will be saved.
    heads_size : int
        Maximum number of example rows to display in the details pop-up when clicking a bar.
        Defaults to 500.
    """
    print(f"Generating new concepts report...")
    spinner = Halo(text='Starting new concept chart generation...', spinner='dots')
    spinner.start("Loading the dataset...")

    # -------------------------------------------------------------------------
    # 1. Load the dataset
    # -------------------------------------------------------------------------
    df = pd.read_excel(input_file)
    spinner.succeed("Dataset loaded successfully.")

    spinner.start("Ensuring FSN is a string...")
    df["FSN"] = df["FSN"].astype(str)
    spinner.succeed("FSN column converted to string.")

    # -------------------------------------------------------------------------
    # 2. Convert creationEffectiveTime to string and sort as categorical
    # -------------------------------------------------------------------------
    spinner.start("Converting and sorting creationEffectiveTime...")
    df["creationEffectiveTime"] = df["creationEffectiveTime"].astype(str)
    df["creationEffectiveTime"] = pd.Categorical(
        df["creationEffectiveTime"],
        categories=sorted(df["creationEffectiveTime"].unique()),
        ordered=True
    )
    spinner.succeed("creationEffectiveTime processed as categorical.")

    # -------------------------------------------------------------------------
    # 3. Extract the semantic tag from FSN
    # -------------------------------------------------------------------------
    spinner.start("Extracting semantic tags from FSN...")
    df["semanticTag"] = df["FSN"].str.extract(r'\(([^()]*)\)$')
    # remove rows where semanticTag is NaN (meaning no parentheses found)
    df.dropna(subset=["semanticTag"], inplace=True)
    spinner.succeed("Semantic tags extracted.")

    # -------------------------------------------------------------------------
    # 4. Group data and compute counts
    # -------------------------------------------------------------------------
    spinner.start("Grouping data by creationEffectiveTime and semanticTag...")
    grouped = df.groupby(["creationEffectiveTime", "semanticTag"], observed=False).size().unstack(fill_value=0)
    spinner.succeed("Data grouped.")

    # Prepare data for Plotly
    fig = go.Figure()

    # Calculate total counts for each creationEffectiveTime
    total_counts = grouped.sum(axis=1)

    # -------------------------------------------------------------------------
    # 5. Add stacked bar traces
    # -------------------------------------------------------------------------
    for tag in tqdm(grouped.columns, desc="Processing Semantic Tags", unit="tag"):
        fig.add_trace(
            go.Bar(
                x=grouped.index.tolist(),
                y=grouped[tag].values,
                name=tag,
                customdata=[
                    {
                        "SemanticTag": tag,
                        "TotalCount": total_counts[time],
                        "Examples": df[
                            (df["creationEffectiveTime"] == time) & (df["semanticTag"] == tag)
                        ].head(heads_size).to_dict('records'),
                        "heads_size": heads_size
                    }
                    for time in grouped.index
                ],
                hovertemplate=(
                    "<b>Semantic Tag:</b> %{customdata.SemanticTag}<br>"
                    "<b>Count:</b> %{y}<br>"
                    "<b>Creation Time:</b> %{x}<br>"
                    "<b>Total Count:</b> %{customdata.TotalCount}<extra></extra>"
                ),
            )
        )

    # -------------------------------------------------------------------------
    # 6. Configure layout
    # -------------------------------------------------------------------------
    spinner.start("Configuring chart layout...")

    num_colors = len(grouped.columns)
    continuous_palette = [cm.turbo(i) for i in np.linspace(0, 1, num_colors)]
    # Convert each (r, g, b, a) to 'rgb(...)'
    continuous_palette = [
        'rgb({},{},{})'.format(int(r*255), int(g*255), int(b*255))
        for r, g, b, _ in continuous_palette
    ]

    fig.update_layout(
        colorway=continuous_palette,
        title="New Concepts by Creation Date and Semantic Tag",
        xaxis_title="Creation Effective Time",
        yaxis_title="Count of New Concepts",
        barmode="stack",
        legend_title="Semantic Tag",
        xaxis=dict(type="category", tickangle=45),
        height=600,
    )
    spinner.succeed("Layout configured.")

    # -------------------------------------------------------------------------
    # 7. Generate JSON for the Plotly figure
    # -------------------------------------------------------------------------
    spinner.start("Generating Plotly JSON...")
    fig_json = pio.to_json(fig)
    spinner.succeed("Plotly JSON generated.")

    # -------------------------------------------------------------------------
    # 8. Create an HTML template for interactive display (no backticks!)
    # -------------------------------------------------------------------------
    html_template = """
<html>
<head>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');
        body {
            font-family: 'Roboto', sans-serif;
        }
        .hover-row {
            transition: background-color 0.2s;
        }
        .hover-row:hover {
            background-color: #dbdbdb;
        }
    </style>
</head>
<body>
    <div id="year-buttons"></div>
    <div id="chart" style="width:100%;height:80%;"></div>
    <div id="details" style="margin-top:10px;border:1px solid black;padding:10px;">
        <h3 id="details-title">Details</h3>
        <div id="details-content">Click on a bar to see details here.</div>
    </div>
    <script>
        var data = REPLACE_ME_WITH_JSON;
        Plotly.newPlot('chart', data.data, data.layout);

        function zoomToYear(year) {
            var chart = document.getElementById('chart');
            if (!data || !data.data || !data.data[0] || !data.data[0].x) {
                console.error("Error: Data is not properly defined.");
                alert("Chart data is unavailable.");
                return;
            }
            var xData = data.data[0].x;
            var yearStr = year.toString();
            var filteredDates = xData.filter(function(date) {
                return date.startsWith(yearStr);
            });
            if (filteredDates.length === 0) {
                alert("No data available for " + year);
                return;
            }
            filteredDates.sort();
            var minDate = filteredDates[0];
            var maxDate = filteredDates[filteredDates.length - 1];
            var idxMin = xData.indexOf(minDate);
            var idxMax = xData.lastIndexOf(maxDate);
            if (idxMin === -1 || idxMax === -1) {
                console.error("Error: Unable to find indices for " + minDate + " - " + maxDate);
                alert("Unexpected error zooming to " + year);
                return;
            }
            var rangeMin = Math.max(0, idxMin - 0.5);
            var rangeMax = idxMax + 0.5;

            var summedYValues = Array(xData.length).fill(0);
            data.data.forEach(function(trace) {
                if (trace.y && trace.x) {
                    trace.y.forEach(function(yValue, index) {
                        if (!isNaN(yValue) && yValue !== undefined) {
                            summedYValues[index] += yValue;
                        }
                    });
                }
            });
            var maxY = Math.max.apply(null, summedYValues.slice(idxMin, idxMax + 1));
            Plotly.relayout(chart, {
                "xaxis.type": "category",
                "xaxis.range": [rangeMin, rangeMax],
                "yaxis.range": [0, maxY * 1.1]
            }).then(function() {
                attachPlotlyClickHandler();
            });
        }

        function attachPlotlyClickHandler() {
            var chart = document.getElementById('chart');
            if (!chart) {
                console.error("Error: Chart element not found.");
                return;
            }
            if (chart.removeAllListeners) {
                chart.removeAllListeners('plotly_click');
            }
            chart.on('plotly_click', function(evt) {
                var detailsDiv = document.getElementById('details-content');
                var titleDiv = document.getElementById('details-title');
                var point = evt.points[0];
                var examples = point.customdata.Examples;

                if (point.y > point.customdata.heads_size) {
                    titleDiv.textContent = "Details for " + point.customdata.SemanticTag + 
                        " - " + point.x + 
                        " (first " + point.customdata.heads_size + 
                        " rows of " + point.y + ")";
                } else {
                    titleDiv.textContent = "Details for " + point.customdata.SemanticTag + 
                        " - " + point.x + 
                        " (all " + point.y + " rows)";
                }

                if (examples && examples.length > 0) {
                    var detailsHtml = "<table style=\\"border-collapse: collapse; width: 100%;\\">" +
                        "<thead>" +
                            "<tr>" +
                                "<th style=\\"border: 1px solid #000; padding: 8px;\\">ConceptId</th>" +
                                "<th style=\\"border: 1px solid #000; padding: 8px;\\">FSN</th>" +
                            "</tr>" +
                        "</thead>" +
                        "<tbody>";
                    examples.forEach(function(example) {
                        detailsHtml += 
                            "<tr class=\\"hover-row\\">" +
                                "<td style=\\"border: 1px solid #000; padding: 8px;\\">" + example.conceptId + "</td>" +
                                "<td style=\\"border: 1px solid #000; padding: 8px;\\">" + example.FSN + "</td>" +
                            "</tr>";
                    });
                    detailsHtml += "</tbody></table>";
                    detailsDiv.innerHTML = detailsHtml;
                } else {
                    detailsDiv.innerHTML = "No examples available.";
                }
            });
        }

        function generateYearButtons() {
            if (!data || !data.data || !data.data[0] || !data.data[0].x) {
                console.error("Error: Data is not properly defined.");
                return;
            }
            var xData = data.data[0].x;
            var years = Array.from(new Set(xData.map(function(date) {
                return date.substring(0, 4);
            })))
            .filter(function(year) {
                return parseInt(year) > 2021;
            })
            .sort();

            var container = document.getElementById('year-buttons');
            container.innerHTML = "";

            var zoomSpan = document.createElement("span");
            zoomSpan.textContent = "Zoom: ";
            container.appendChild(zoomSpan);

            var resetButton = document.createElement("button");
            resetButton.textContent = "Reset";
            resetButton.style.marginRight = "10px";
            resetButton.onclick = resetZoom;
            container.appendChild(resetButton);

            years.forEach(function(year) {
                var button = document.createElement("button");
                // Instead of using backticks, just convert the year to string
                button.textContent = String(year);
                button.style.marginRight = "5px";
                button.onclick = function() {
                    zoomToYear(year);
                };
                container.appendChild(button);
            });
        }

        function resetZoom() {
            var chart = document.getElementById('chart');
            if (!data || !data.layout || !data.data) {
                console.error("Error: Data is not properly defined.");
                alert("Chart data is unavailable.");
                return;
            }
            Plotly.relayout(chart, {
                "xaxis.autorange": true,
                "yaxis.autorange": true
            }).then(function() {
                attachPlotlyClickHandler();
            });
        }

        setTimeout(generateYearButtons, 100);
        setTimeout(attachPlotlyClickHandler, 100);
    </script>
</body>
</html>
"""

    # -------------------------------------------------------------------------
    # 9. Insert the Plotly JSON and write out the final HTML
    # -------------------------------------------------------------------------
    spinner.start(f"Writing final HTML to {output_html}...")
    html_output = html_template.replace("REPLACE_ME_WITH_JSON", fig_json)

    with open(output_html, "w", encoding="utf-8") as f:
        f.write(html_output)

    spinner.succeed(f"HTML file with interactive chart created: {output_html}")


if __name__ == "__main__":
    # If run directly, we use the default arguments, including heads_size=500
    generate_new_concepts_report()
