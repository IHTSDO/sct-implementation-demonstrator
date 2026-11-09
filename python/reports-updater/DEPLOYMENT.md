# 🚀 Deployment Checklist

## ✅ Pre-Deployment Status

### Configuration Complete

- ✅ **GitHub Environment**: `reports-updates` created with secrets
- ✅ **Secrets configured**: `SNOMED_USER` and `SNOMED_PASSWORD`
- ✅ **Workflow file**: `.github/workflows/generate-reports.yml` ready
- ✅ **Documentation**: Complete in English

### What Happens After Push

When you push this code to GitHub:

1. **Workflow will be available** in Actions tab
2. **Automatic runs** will be scheduled for 2nd of each month
3. **Manual execution** available immediately via "Run workflow" button

## 📋 Deployment Steps

### 1. Commit Changes

```bash
git add .
git commit -m "Add SNOMED report generation automation"
```

### 2. Push to GitHub

```bash
git push origin main
```

### 3. Verify Workflow

1. Go to GitHub repository
2. Click **Actions** tab
3. Verify "Generate SNOMED Reports" appears in workflows list

### 4. Test Manual Execution (Recommended)

1. In Actions tab, click **"Generate SNOMED Reports"**
2. Click **"Run workflow"** button (right side)
3. Click green **"Run workflow"** to confirm
4. Wait ~20-30 minutes for completion

### 5. Verify Results

After successful run:

```
✅ Check commit history for:
   "🤖 Auto-update: SNOMED reports for YYYY-MM-DD"

✅ Verify new files in:
   src/assets/reports/
   ├── detect_inactivations_by_reason.json
   ├── fsn_changes_with_details.json
   └── new_concepts_by_semantic_tag.json
```

## 🔍 Verification Checklist

### Environment Configuration

- [ ] Environment `reports-updates` exists
- [ ] Secret `SNOMED_USER` is set
- [ ] Secret `SNOMED_PASSWORD` is set
- [ ] Secrets are not expired

### Repository Setup

- [ ] Workflow file exists in `.github/workflows/`
- [ ] Python scripts are in `python/` directory
- [ ] `.gitignore` excludes `python/data/` and `python/output/`

### First Run Test

- [ ] Manual workflow execution succeeded
- [ ] JSON files generated in `src/assets/reports/`
- [ ] Commit was created automatically
- [ ] Changes pushed to repository

## 📅 Schedule

### Automatic Runs

**When**: 2nd of each month at 3:00 AM UTC

**Next scheduled runs:**
- December 2, 2025 @ 3:00 AM UTC
- January 2, 2026 @ 3:00 AM UTC
- February 2, 2026 @ 3:00 AM UTC
- etc.

### Manual Runs

**When**: Anytime you want!

**How**: 
1. Actions → Generate SNOMED Reports → Run workflow

## 🔒 Security Notes

### Secrets Management

- ✅ Secrets stored in GitHub Environment (encrypted)
- ✅ Never exposed in logs (GitHub masks them)
- ✅ Only accessible to workflow runs
- ✅ Can be rotated without code changes

### Permissions

The workflow needs:
- ✅ Read access to repository code
- ✅ Write access to commit JSON files
- ✅ Access to environment secrets

Default token permissions are sufficient (no special setup needed).

## 🐛 Troubleshooting

### If workflow doesn't appear after push

**Solution**: Wait 1-2 minutes for GitHub to process the workflow file.

### If manual run fails with "Environment not found"

**Solution**: 
1. Verify environment name is exactly `reports-updates`
2. Check Settings → Environments

### If run fails with "401 Unauthorized"

**Solution**:
1. Verify secrets are correct
2. Test credentials at https://mlds.ihtsdotools.org/
3. Ensure account has download permissions
4. See SETUP.md for detailed troubleshooting

### If no commit is created

**Possible causes**:
1. No changes in reports (already up to date)
2. Workflow checks for changes before committing
3. This is normal behavior if reports haven't changed

## 📊 Monitoring

### View Execution History

1. Go to **Actions** tab
2. Click on any workflow run
3. View detailed logs for each step
4. Check execution time and status

### Success Indicators

- ✅ Green checkmark next to workflow run
- ✅ New commit in history
- ✅ Updated JSON files in repository
- ✅ Files accessible via Angular app

### Failure Indicators

- ❌ Red X next to workflow run
- ❌ Error messages in logs
- ❌ No new commit created

## 📈 Next Steps After Deployment

1. **Test the workflow** - Run it manually once
2. **Verify reports** - Check that JSON files are generated
3. **Set reminders** - Note when next automatic run will occur
4. **Monitor first automatic run** - Check results on December 2nd

## 🎯 Success Criteria

Deployment is successful when:

- ✅ Workflow appears in Actions tab
- ✅ Manual execution completes successfully
- ✅ JSON reports are generated and committed
- ✅ Files are accessible in the Angular app
- ✅ Automatic schedule is configured correctly

---

**Current Status**: 🟢 Ready for deployment!

**Environment**: `reports-updates` ✅ Configured  
**Workflow**: `.github/workflows/generate-reports.yml` ✅ Ready  
**Documentation**: Complete ✅  
**Testing**: Ready for first run ✅  

**Next Action**: Push to GitHub and test manual execution! 🚀

