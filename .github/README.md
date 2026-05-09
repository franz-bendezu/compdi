# GitHub Configuration

This directory contains GitHub-specific configuration files including Actions workflows and documentation.

## Contents

### [workflows/release.yml](./workflows/release.yml)
Automated release and publication workflow for publishing packages to npm.

**Features:**
- ✓ Manual trigger with configurable inputs
- ✓ Dry-run mode for safe testing
- ✓ Full build and typecheck validation
- ✓ Distribution file integrity checks
- ✓ Secure npm token handling via GitHub Secrets
- ✓ Automatic git tagging
- ✓ GitHub Release creation
- ✓ npm registry verification

**Usage:**
1. Go to **Actions** tab in GitHub
2. Select **Release & Publish** workflow
3. Click **Run workflow**
4. Choose:
   - `version-bump`: patch, minor, or major
   - `dry-run`: true for testing, false to publish

### [RELEASE_SETUP.md](./RELEASE_SETUP.md)
Complete setup guide for configuring the release workflow.

**Includes:**
- Step-by-step npm token creation
- GitHub Secrets configuration
- Workflow permission setup
- Running the workflow
- Troubleshooting guide
- Manual publishing alternative

### [SECURITY.md](./SECURITY.md)
Comprehensive security best practices for npm publishing in CI/CD.

**Covers:**
- Token management strategy
- Security architecture
- Preventing common mistakes
- Enhanced security configuration
- Vulnerability scanning
- Rollback procedures
- Maintenance checklist
- Emergency response plan

## Quick Start

1. **Create npm token** (see RELEASE_SETUP.md)
2. **Add to GitHub Secrets** with key `NPM_TOKEN`
3. **Enable workflow permissions** (Read and write)
4. **Trigger workflow** manually when ready

## Security Summary

✓ Tokens stored in encrypted GitHub Secrets
✓ Full validation before publishing
✓ Dry-run mode for testing
✓ Automatic git tags and releases
✓ npm registry verification
✓ Private packages protected from publication
✓ Audit trail via Actions logs

## Workflow Triggers

The release workflow can be triggered:
- **Manually** via GitHub UI (recommended)
- **Via GitHub CLI**: `gh workflow run release.yml`
- **Scheduled** (via cron - not configured)

## Permissions Required

GitHub repository needs:
- ✓ Contents: Write (for git tags)
- ✓ Packages: Write (for publishing)
- ✓ Actions: Read (for workflow access)

## Additional Resources

- [npm-cli documentation](https://docs.npmjs.com/cli)
- [GitHub Actions secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [npm tokens](https://docs.npmjs.com/creating-and-viewing-authentication-tokens)
