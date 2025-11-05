# SNOMED CT Report Generator

Python scripts to automatically generate analytical reports for SNOMED CT International Edition.

## 🎯 Features

- **Automatic Download**: Fetches the latest SNOMED CT International version from the MLDS syndication feed
  - 📡 The feed is public (no authentication required)
  - 🔐 ZIP file download requires MLDS credentials
- **Comprehensive Analysis**: Generates 3 types of reports:
  - Concept inactivations with historical reasons
  - FSN (Fully Specified Name) changes
  - New concepts by semantic tag
- **Interactive Visualizations**: HTML charts with Plotly
- **Excel Outputs**: Spreadsheets for detailed analysis

## 📋 Requirements

- Python 3.11+
- Account at [SNOMED International MLDS](https://mlds.ihtsdotools.org/)

## 🚀 Installation

1. Install dependencies:

```bash
cd python
pip install -r requirements.txt
```

2. Configure MLDS credentials:

Create a `.env` file in the `python/` directory:

```bash
SNOMED_USER=your_email@example.com
SNOMED_PASSWORD=your_password
```

## 💻 Usage

### Test connection (recommended first)

```bash
python3 test_connection.py
```

This script verifies that your MLDS credentials work correctly without downloading the complete files.

### Generate all reports

```bash
python3 run-reports.py
```

This script will automatically:

1. ✅ Download the latest SNOMED CT International version
2. ✅ Locate required RF2 files
3. ✅ Generate 3 reports (Excel + HTML)
4. ✅ Save to `../src/assets/reports/`

### Run individual scripts

```bash
# Download latest version only
python3 syndication_downloader.py

# Detect inactivations only
python3 detect_inactivations.py

# Detect FSN changes only
python3 fsn_changes.py

# Detect new concepts only
python3 new_concepts.py
```

## 📊 Generated Reports

Reports are saved to two locations:

**Excel files** (`python/output/`):
- `detect-inactivations.xlsx`
- `fsn-changes.xlsx`
- `list-new-concepts.xlsx`

**HTML files** (`src/assets/reports/`):
- `detect_inactivations_by_reason.html`
- `fsn_changes_with_details.html`
- `new_concepts_by_semantic_tag.html`

### Report Contents

1. **Inactivations**
   - Concepts inactivated by reason (Duplicate, Outdated, etc.)
   - Historical associations (SAME_AS, REPLACED_BY, etc.)

2. **FSN Changes**
   - Changes in Fully Specified Names
   - Analysis by semantic tag

3. **New Concepts**
   - New concepts added
   - Distribution by semantic tag

## 🤖 GitHub Actions Automation

The workflow `.github/workflows/generate-reports.yml` runs:

- 📅 **Automatically**: Day 2 of each month at 3 AM UTC
- 🔄 **Manually**: Click "Run workflow" in GitHub Actions tab (anytime!)

### Quick Setup:

The workflow uses the GitHub Environment **`reports-updates`** with two secrets:
- `SNOMED_USER`: Your MLDS email
- `SNOMED_PASSWORD`: Your MLDS password

**Setup**:
1. Go to **Settings** → **Environments** → **reports-updates**
2. Verify the secrets are configured (you already did this!)

### Manual Execution:

1. Go to **Actions** tab in GitHub
2. Select **"Generate SNOMED Reports"**
3. Click **"Run workflow"** button
4. Click the green **"Run workflow"** to confirm

📖 **Detailed guide**: See [GITHUB_ACTIONS.md](GITHUB_ACTIONS.md) for step-by-step instructions with troubleshooting

## 🏗️ Architecture

```
python/
├── run-reports.py                      # Main orchestrator script
├── syndication_downloader.py           # Download from MLDS feed
├── download_and_extract.py             # Download and extraction with progress
├── file_locator.py                     # Locates RF2 files
├── detect_inactivations.py             # Inactivation analysis
├── detect_inactivations_graph_details.py
├── fsn_changes.py                      # FSN changes analysis
├── fsn_changes_graph_details.py
├── new_concepts.py                     # New concepts analysis
├── new_concepts_graph_details.py
├── requirements.txt                    # Python dependencies
├── README.md                           # This file
├── SETUP.md                            # Setup guide
├── GITHUB_ACTIONS.md                   # GitHub Actions guide (NEW!)
├── CHANGELOG.md                        # Change history
├── STATUS.md                           # Project status
└── QUICKSTART.txt                      # Quick start guide
```

## 🔧 Advanced Configuration

### Package Filters

The script automatically filters by acceptable package types (similar to Snowstorm Lite Java client):

```python
ACCEPTABLE_PACKAGE_TYPES = {
    "SCT_RF2_SNAPSHOT",
    "SCT_RF2_FULL", 
    "SCT_RF2_ALL"
}
```

### Graph Limits

By default, HTML charts show the top 1500 entries. Adjust in `run-reports.py`:

```python
generate_inactivation_report(xlsx, html, limit=1500)
```

## 🐛 Troubleshooting

### Error: "cannot import name 'download_latest_international'"

Ensure `syndication_downloader.py` is complete and has no syntax errors.

### Error: "SNOMED_USER and SNOMED_PASSWORD must be set"

Create the `.env` file with the correct credentials.

### Error: "No International Edition found"

Verify:
- Correct MLDS credentials
- Internet access
- Permissions on your MLDS account

## 📚 References

- [SNOMED International MLDS](https://mlds.ihtsdotools.org/)
- [Syndication Feed API](https://mlds.ihtsdotools.org/api/feed)
- [SNOMED CT RF2 Specification](https://confluence.ihtsdotools.org/display/DOCRELFMT/SNOMED+CT+Release+File+Specifications)

## 📝 License

See LICENSE.md in the project root directory.

## 👥 Contributions

Inspired by the [Snowstorm Lite Syndication Client](https://github.com/IHTSDO/snowstorm-lite) (Java).

