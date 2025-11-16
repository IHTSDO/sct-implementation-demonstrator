#!/usr/bin/env python3
import json
import pandas as pd
import plotly.graph_objects as go
from halo import Halo
import numpy as np
from matplotlib import cm
import plotly.express as px
from ci_utils import is_ci

def generate_inactivation_report(
    inactivation_data_path: str,
    output_path: str,
    heads_size = 500
):
    """
    Generate an interactive HTML report of concept inactivations from an Excel file
    (detect-inactivations.xlsx), grouped by EffectiveTime and Inactivation Reason.

    Parameters
    ----------
    file_path : str
        Path to the Excel file containing inactivation data.
    output_path : str
        Path where the output HTML report should be written.
    """
    if not is_ci():
        print("Generating Inactivation Report...")
    # Initialize Halo spinner (disabled in CI to reduce log verbosity)
    spinner = Halo(text="Starting Inactivation Report Generation...", spinner="dots", enabled=not is_ci())
    spinner.start()

    # --- Load Dataset ---
    spinner.start("Loading dataset...")
    try:
        df = pd.read_excel(inactivation_data_path)
        spinner.succeed("Dataset loaded successfully.")
    except Exception as e:
        spinner.fail(f"Error loading dataset: {e}")
        return  # or sys.exit(1)

    # --- Convert FSN to String ---
    spinner.start("Ensuring FSN is a string...")
    df["FSN"] = df["FSN"].astype(str)
    spinner.succeed("FSN column converted to string.")

    # --- Convert and Sort Effective Time ---
    spinner.start("Processing inactivationEffectiveTime...")
    df["inactivationEffectiveTime"] = df["inactivationEffectiveTime"].astype(str)
    df["inactivationEffectiveTime"] = pd.Categorical(
        df["inactivationEffectiveTime"],
        categories=sorted(df["inactivationEffectiveTime"].unique()),
        ordered=True
    )
    spinner.succeed("inactivationEffectiveTime processed.")

    # --- Clean Inactivation Reasons ---
    spinner.start("Cleaning inactivation reason FSNs...")
    df["inactivationReasonFSN"] = df["inactivationReasonFSN"].str.replace(r'\(.*\)', '', regex=True)
    spinner.succeed("Inactivation reason FSNs cleaned.")

    # --- Clean Historical Associations ---
    spinner.start("Processing historical associations...")
    df["historicalAssociations"] = df["historicalAssociations"].fillna('')
    df["historicalAssociations"] = df["historicalAssociations"].replace('null', '')
    df["historicalAssociations"] = df["historicalAssociations"].str.replace('),', ')<br>')
    spinner.succeed("Historical associations processed.")

    # --- Group Data ---
    spinner.start("Grouping data by Effective Time and Inactivation Reason...")
    grouped = df.groupby(["inactivationEffectiveTime", "inactivationReasonFSN"], observed=False).size().unstack(fill_value=0)
    spinner.succeed("Data grouped successfully.")

    # --- Create Plotly Figure ---
    spinner.start("Generating Plotly visualization...")
    fig = go.Figure()

    # Compute total counts
    total_counts = grouped.sum(axis=1)

    # Add traces for each inactivation reason
    for reason in grouped.columns:
        fig.add_trace(go.Bar(
            x=grouped.index.tolist(),
            y=grouped[reason].values,
            name=reason,
            customdata=[
                {
                    "InactivationReason": reason,
                    "TotalCount": total_counts[time],
                    "Examples": df[(df["inactivationEffectiveTime"] == time) & (df["inactivationReasonFSN"] == reason)].head(heads_size).to_dict('records'),
                    "heads_size": heads_size
                }
                for time in grouped.index
            ],
            hovertemplate=(
                "<b>Inactivation Reason:</b> %{customdata.InactivationReason}<br>"
                "<b>Count:</b> %{y}<br>"
                "<b>Effective Time:</b> %{x}<br>"
                "<b>Total Count:</b> %{customdata.TotalCount}<extra></extra>"
            ),
        ))
    spinner.succeed("Plotly visualization created.")

    # --- Update Layout ---
    spinner.start("Configuring chart layout...")
    # Generate a continuous color scale with colors for each reason
    num_colors = len(grouped.columns)
    continuous_palette = [cm.turbo(i) for i in np.linspace(0, 1, num_colors)]
    continuous_palette = [
        'rgb({},{},{})'.format(int(r*255), int(g*255), int(b*255)) 
        for r, g, b, _ in continuous_palette
    ]

    fig.update_layout(
        colorway=px.colors.qualitative.Plotly,
        title="Inactivation Reasons by Effective Time",
        xaxis_title="Effective Time",
        yaxis_title="Count",
        barmode="stack",
        legend_title="Inactivation Reason",
        xaxis=dict(type="category", tickangle=45),
        height=600,
    )
    spinner.succeed("Chart layout configured.")

    # --- Generate JSON for HTML ---
    spinner.start("Generating Plotly JSON...")
    # Use json.dumps to ensure arrays are serialized as JSON arrays, not binary format
    fig_json = json.dumps(fig.to_dict())
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
                                        <th style="border: 1px solid #000; padding: 8px;">FSN</th>
                                        <th style="border: 1px solid #000; padding: 8px;">Inactivation Reason</th>
                                        <th style="border: 1px solid #000; padding: 8px;">Historical Associations</th>
                                    </tr>
                                </thead>
                                <tbody>
                        `;
                        examples.forEach(function(example) {
                            detailsHtml += `
                                <tr class="hover-row">
                                    <td style="border: 1px solid #000; padding: 8px;">${example.conceptId}</td>
                                    <td style="border: 1px solid #000; padding: 8px;">${example.FSN}</td>
                                    <td style="border: 1px solid #000; padding: 8px;">${example.inactivationReasonFSN}</td>
                                    <td style="border: 1px solid #000; padding: 8px;">${example.historicalAssociations}</td>
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


# ------------------------------------------------------------------------------
# If you want to run THIS script *directly*, you can provide default paths here.
# Otherwise, you can import this script and call generate_inactivation_report(...)
# from your own runner script with custom file paths.
# ------------------------------------------------------------------------------
if __name__ == "__main__":
    DEFAULT_INPUT_PATH = "sct-changes-reports/detect-inactivations.xlsx"
    DEFAULT_OUTPUT_PATH = "sct-changes-reports/detect_inactivations_by_reason.html"

    generate_inactivation_report(
        inactivation_data_path=DEFAULT_INPUT_PATH,
        output_path=DEFAULT_OUTPUT_PATH
    )
