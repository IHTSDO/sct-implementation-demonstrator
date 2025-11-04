#!/usr/bin/env python3

import pandas as pd
import plotly.graph_objects as go
import plotly.io as pio
import numpy as np
from matplotlib import cm
from halo import Halo

def generate_fsn_changes_report(
    fsn_changes_data_path: str,
    output_path: str,
    heads_size = 500
):
    """
    Generate an interactive HTML report of FSN changes, grouped by EffectiveTime
    and SemanticTag, from an Excel file containing FSN change data.

    Parameters
    ----------
    file_path : str
        Path to the Excel file containing FSN change data.
    output_path : str
        Path where the output HTML report should be written.
    """
    print("Generating FSN Changes Report...")

    # Initialize Halo spinner
    spinner = Halo(text="Starting FSN Changes Report Generation...", spinner="dots")
    spinner.start()

    # --- Load Dataset ---
    spinner.start("Loading dataset...")
    try:
        df = pd.read_excel(fsn_changes_data_path)
        spinner.succeed("Dataset loaded successfully.")
    except Exception as e:
        spinner.fail(f"Error loading dataset: {e}")
        return  # or sys.exit(1) if you prefer

    # --- Extract Semantic Tags ---
    spinner.start("Extracting semantic tags...")

    def extract_semantic_tag(fsn):
        if "(" in fsn and ")" in fsn:
            return fsn.split("(")[-1].split(")")[0]
        return "Unknown"

    df["SemanticTag"] = df["AfterFSN"].apply(extract_semantic_tag)
    spinner.succeed("Semantic tags extracted.")

    # --- Convert and Sort EffectiveTime ---
    spinner.start("Processing AfterEffectiveTime...")
    df["AfterEffectiveTime"] = df["AfterEffectiveTime"].astype(str)
    df["AfterEffectiveTime"] = pd.Categorical(
        df["AfterEffectiveTime"], 
        categories=sorted(df["AfterEffectiveTime"].unique()), 
        ordered=True
    )
    spinner.succeed("AfterEffectiveTime processed.")

    # --- Group Data ---
    spinner.start("Grouping data by EffectiveTime and SemanticTag...")
    grouped = df.groupby(["AfterEffectiveTime", "SemanticTag"], observed=False).size().unstack(fill_value=0)
    spinner.succeed("Data grouped successfully.")

    # --- Create Plotly Figure ---
    spinner.start("Generating Plotly visualization...")
    fig = go.Figure()

    # Compute total counts
    total_counts = grouped.sum(axis=1)

    # Add a trace for each semantic tag
    for tag in grouped.columns:
        fig.add_trace(go.Bar(
            x=grouped.index.tolist(),
            y=grouped[tag].values,
            name=tag,
            customdata=[
                {
                    "SemanticTag": tag,
                    "TotalCount": total_counts[time],
                    "Examples": df[
                        (df["AfterEffectiveTime"] == time) &
                        (df["SemanticTag"] == tag)
                    ].head(heads_size).to_dict('records'),
                    "heads_size": heads_size
                }
                for time in grouped.index
            ],
            hovertemplate=(
                "<b>Semantic Tag:</b> %{customdata.SemanticTag}<br>"
                "<b>Count:</b> %{y}<br>"
                "<b>Effective Time:</b> %{x}<br>"
                "<b>Total Count:</b> %{customdata.TotalCount}<extra></extra>"
            ),
        ))
    spinner.succeed("Plotly visualization created.")

    # --- Color Palette ---
    spinner.start("Generating color palette...")
    num_colors = len(grouped.columns)
    continuous_palette = [cm.turbo(i) for i in np.linspace(0, 1, num_colors)]
    continuous_palette = [
        'rgb({},{},{})'.format(int(r*255), int(g*255), int(b*255))
        for r, g, b, _ in continuous_palette
    ]

    # Shuffle the palette in a reproducible random order with a seed
    np.random.seed(0)
    np.random.shuffle(continuous_palette)
    spinner.succeed("Color palette generated.")

    # --- Update Layout ---
    spinner.start("Configuring chart layout...")
    fig.update_layout(
        colorway=continuous_palette,
        title="FSN Changes by Effective Time and Semantic Tag",
        xaxis_title="Effective Time",
        yaxis_title="Count",
        barmode="stack",
        legend_title="Semantic Tag",
        xaxis=dict(type="category", tickangle=45),
        height=600,
    )
    spinner.succeed("Chart layout configured.")

    # --- Generate JSON for HTML ---
    spinner.start("Generating Plotly JSON...")
    fig_json = pio.to_json(fig)
    spinner.succeed("Plotly JSON generated.")

    # --- HTML Template ---
    spinner.start("Creating interactive HTML template...")
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

            function attachPlotlyClickHandler() {
                var chart = document.getElementById('chart');
                if (!chart) {
                    console.error("Error: Chart element not found.");
                    return;
                }
                chart.removeAllListeners && chart.removeAllListeners('plotly_click');
                chart.on('plotly_click', function(data) {
                    var detailsDiv = document.getElementById('details-content');
                    var titleDiv = document.getElementById('details-title');
                    var point = data.points[0];
                    var examples = point.customdata.Examples;

                    if (point.y > point.customdata.heads_size) {
                        titleDiv.textContent = `Details for ${point.customdata.SemanticTag} - ${point.x} (first ${point.customdata.heads_size} rows of ${point.y})`;
                    } else {
                        titleDiv.textContent = `Details for ${point.customdata.SemanticTag} - ${point.x} (all ${point.y} rows)`;
                    }

                    if (examples && examples.length > 0) {
                        var detailsHtml = `
                            <table style="border-collapse: collapse; width: 100%;">
                                <thead>
                                    <tr>
                                        <th style="border: 1px solid #000; padding: 8px;">ConceptId</th>
                                        <th style="border: 1px solid #000; padding: 8px;">Before FSN</th>
                                        <th style="border: 1px solid #000; padding: 8px;">After FSN</th>
                                    </tr>
                                </thead>
                                <tbody>
                        `;
                        examples.forEach(function(example) {
                            detailsHtml += `
                                <tr class="hover-row">
                                    <td style="border: 1px solid #000; padding: 8px;">${example.ConceptId}</td>
                                    <td style="border: 1px solid #000; padding: 8px;">${example.BeforeFSN}</td>
                                    <td style="border: 1px solid #000; padding: 8px;">${example.AfterFSN}</td>
                                </tr>
                            `;
                        });
                        detailsHtml += `</tbody></table>`;
                        detailsDiv.innerHTML = detailsHtml;
                    } else {
                        detailsDiv.innerHTML = 'No examples available.';
                    }
                });
            }

            function zoomToYear(year) {
                var chart = document.getElementById('chart');
                if (!data || !data.data || !data.data[0] || !data.data[0].x) {
                    console.error("Error: Data is not properly defined.");
                    alert("Chart data is unavailable.");
                    return;
                }
                var xData = data.data[0].x;
                var yearStr = year.toString();
                var filteredDates = xData.filter(date => date.startsWith(yearStr));
                if (filteredDates.length === 0) {
                    alert(`No data available for ${year}`);
                    return;
                }
                filteredDates.sort();
                var minDate = filteredDates[0];
                var maxDate = filteredDates[filteredDates.length - 1];
                var idxMin = xData.indexOf(minDate);
                var idxMax = xData.lastIndexOf(maxDate);
                if (idxMin === -1 || idxMax === -1) {
                    console.error(`Error: Unable to find indices for ${minDate} - ${maxDate}`);
                    alert(`Unexpected error zooming to ${year}`);
                    return;
                }
                var rangeMin = Math.max(0, idxMin - 0.5);
                var rangeMax = idxMax + 0.5;

                var summedYValues = Array(xData.length).fill(0);
                data.data.forEach(trace => {
                    if (trace.y && trace.x) {
                        trace.y.forEach((yValue, index) => {
                            if (!isNaN(yValue) && yValue !== undefined) {
                                summedYValues[index] += yValue;
                            }
                        });
                    }
                });
                var maxY = Math.max(...summedYValues.slice(idxMin, idxMax + 1));

                Plotly.relayout(chart, {
                    "xaxis.type": "category",
                    "xaxis.range": [rangeMin, rangeMax],
                    "yaxis.range": [0, maxY * 1.1]
                }).then(() => attachPlotlyClickHandler());
            }

            function generateYearButtons() {
                if (!data || !data.data || !data.data[0] || !data.data[0].x) {
                    console.error("Error: Data is not properly defined.");
                    return;
                }
                var xData = data.data[0].x;
                var years = [...new Set(xData.map(date => date.substring(0, 4)))]
                    .filter(year => parseInt(year) > 2021)
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

                years.forEach(year => {
                    var button = document.createElement("button");
                    button.textContent = `${year}`;
                    button.style.marginRight = "5px";
                    button.onclick = () => zoomToYear(year);
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
                }).then(() => attachPlotlyClickHandler());
            }
            setTimeout(generateYearButtons, 100);
            setTimeout(attachPlotlyClickHandler, 100);
        </script>
    </body>
    </html>
    """
    spinner.succeed("HTML template created.")

    # --- Insert JSON & Save File ---
    spinner.start(f"Writing final HTML to {output_path}...")
    html_output = html_template.replace("REPLACE_ME_WITH_JSON", fig_json)

    try:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_output)
        spinner.succeed(f"HTML file with interactive chart created: {output_path}")
    except Exception as e:
        spinner.fail(f"Error writing HTML file: {e}")
        return


def main():
    """
    Run this script directly with default file paths.
    If calling from a separate runner, use generate_fsn_changes_report(...) directly.
    """
    DEFAULT_INPUT_PATH = "sct-changes-reports/fsn-changes.xlsx"
    DEFAULT_OUTPUT_PATH = "sct-changes-reports/fsn_changes_with_details.html"

    generate_fsn_changes_report(
        fsn_changes_data_path=DEFAULT_INPUT_PATH,
        output_path=DEFAULT_OUTPUT_PATH
    )


if __name__ == "__main__":
    main()
