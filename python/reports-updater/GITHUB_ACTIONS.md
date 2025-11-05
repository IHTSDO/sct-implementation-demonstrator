# 🤖 GitHub Actions Guide

## Schedule

The workflow runs **automatically** on:
- **Day 2 of each month** at 3:00 AM UTC

## Manual Execution

You can run the workflow **manually at any time**:

### Step-by-Step Instructions

1. **Go to your GitHub repository**
   ```
   https://github.com/[your-username]/sct-implementation-demonstrator
   ```

2. **Click on the "Actions" tab** (at the top of the page)

3. **Select "Generate SNOMED Reports"** (from the left sidebar)

4. **Click "Run workflow"** button (on the right side)

5. **Click the green "Run workflow"** button in the dropdown

6. **Wait for execution** (~20-30 minutes)
   - You'll see a yellow dot while running
   - Green checkmark when successful
   - Red X if it fails

### Visual Guide

```
┌─────────────────────────────────────────────────┐
│  GitHub Repository                              │
├─────────────────────────────────────────────────┤
│  <> Code    Issues    Pull requests    Actions │ ← Click here
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Actions                                        │
├──────────────────┬──────────────────────────────┤
│  All workflows   │  All workflow runs           │
│  ├─ Generate     │  ┌──────────────────────┐   │
│  │  SNOMED       │  │ Run workflow ▼       │   │ ← Click here
│  │  Reports      │  └──────────────────────┘   │
│  └─ ...          │                              │
└──────────────────┴──────────────────────────────┘
```

## First Time Setup

The workflow uses a GitHub **Environment** named `reports-updates` with secrets configured.

### If Environment Already Exists

If you already created the environment with secrets, you're all set! Skip to "Manual Execution" section.

### If You Need to Create It

**Option A: Using an existing environment (recommended if already created)**

The workflow will use the environment `reports-updates` automatically if it exists with these secrets:
- `SNOMED_USER`
- `SNOMED_PASSWORD`

**Option B: Create environment manually**

1. Go to **Settings** → **Environments**

2. Click **"New environment"** (or select existing `reports-updates`)

3. Name it: `reports-updates`

4. Under **Environment secrets**, add:

   **Secret 1:**
   - Name: `SNOMED_USER`
   - Value: Your MLDS email (e.g., `your_email@example.com`)

   **Secret 2:**
   - Name: `SNOMED_PASSWORD`
   - Value: Your MLDS password

5. Click **"Add secret"** for each

### Verify Environment

Go to **Settings** → **Environments** → **reports-updates**

You should see:
```
Environment secrets:
SNOMED_USER          •••••••••••••••   Updated X seconds ago
SNOMED_PASSWORD      •••••••••••••••   Updated X seconds ago
```

## What the Workflow Does

1. ✅ Checks out the code
2. ✅ Sets up Python 3.11
3. ✅ Installs dependencies
4. ✅ Downloads latest SNOMED International release
5. ✅ Generates 3 HTML reports
6. ✅ Commits HTML files to `src/assets/reports/`
7. ✅ Pushes changes to repository

## Viewing Results

After successful execution:

1. Check the commit history for:
   ```
   🤖 Auto-update: SNOMED reports for YYYY-MM-DD
   ```

2. View updated files:
   ```
   src/assets/reports/
   ├── detect_inactivations_by_reason.html
   ├── fsn_changes_with_details.html
   └── new_concepts_by_semantic_tag.html
   ```

3. Files are automatically served by your Angular app

## Troubleshooting

### Workflow fails with "401 Unauthorized"

**Cause**: MLDS credentials don't have download permissions

**Solution**:
1. Log in to https://mlds.ihtsdotools.org/
2. Try downloading a file manually
3. Accept any required terms/agreements
4. Verify account has "Member" or "Affiliate" status
5. Re-run the workflow

### Workflow doesn't appear

**Cause**: Workflow file not pushed to main branch

**Solution**:
```bash
git add .github/workflows/generate-reports.yml
git commit -m "Add GitHub Actions workflow"
git push
```

### Secrets not working

**Cause**: Secrets not set or incorrect names

**Solution**:
1. Verify secret names are exactly:
   - `SNOMED_USER` (not SNOMED_USERNAME)
   - `SNOMED_PASSWORD` (not PASSWORD)
2. No spaces in secret names
3. Values are correct

## Logs

To view detailed execution logs:

1. Click on the workflow run
2. Click on the job "build-reports"
3. Expand each step to see output
4. Look for errors in red

## Schedule Explanation

The cron expression `0 3 2 * *` means:
- `0` = minute 0
- `3` = hour 3 (3 AM UTC)
- `2` = day 2 of month
- `*` = every month
- `*` = any day of week

**Example runs:**
- December 2, 2025 at 3:00 AM UTC
- January 2, 2026 at 3:00 AM UTC
- February 2, 2026 at 3:00 AM UTC
- etc.

## Cost

GitHub Actions is **free** for public repositories with generous limits:
- 2,000 minutes/month for free accounts
- This workflow uses ~20-30 minutes per run
- Running monthly = ~30 minutes/month (well within limits)

For private repositories:
- Free tier: 2,000 minutes/month
- This workflow is still covered by free tier

## Next Steps

After pushing this to GitHub:

1. ✅ Configure secrets (one-time)
2. ✅ Run workflow manually to test
3. ✅ Wait for automatic monthly runs
4. ✅ Check commit history for updates

---

**Status**: Ready to use after secrets are configured! 🚀

