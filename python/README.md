# Python Scripts

This directory contains Python scripts and tools for the SCT Implementation Demonstrator project.

## 📂 Directory Structure

```
python/
├── README.md                  # This file
└── reports-updater/          # SNOMED CT report generation automation
    ├── README.md             # Full documentation
    ├── run-reports.py        # Main script
    ├── requirements.txt      # Dependencies
    └── ...                   # Supporting scripts
```

## 🔧 Current Tools

### Reports Updater

Automated system for generating SNOMED CT analytical reports:
- Downloads latest SNOMED CT International Edition
- Generates Excel and HTML reports
- Integrated with GitHub Actions for monthly updates

**Location**: `reports-updater/`  
**Documentation**: See [reports-updater/README.md](reports-updater/README.md)

## 🚀 Adding New Tools

This structure allows for adding more Python scripts in the future:

```
python/
├── reports-updater/          # Report generation
├── terminology-validator/    # Future: Validation tools
├── concept-browser/          # Future: Browse SNOMED concepts
└── mapping-tools/            # Future: Mapping utilities
```

Each tool should:
1. Have its own subdirectory
2. Include a `README.md` with documentation
3. Have its own `requirements.txt` if needed
4. Be independent and self-contained

## 📝 Conventions

- **Python version**: 3.11+
- **Code style**: Follow PEP 8
- **Documentation**: Include README.md in each subdirectory
- **Dependencies**: Use `requirements.txt` per tool
- **Environment variables**: Use `.env` files (Git-ignored)

## 🔗 Links

- [Reports Updater Documentation](reports-updater/README.md)
- [GitHub Actions Workflow](../.github/workflows/generate-reports.yml)

---

**Note**: Each subdirectory is self-contained with its own documentation, dependencies, and configuration.

