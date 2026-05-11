# GitHub Actions Release Configuration

## Trusted Publishing Setup

This repository is public and uses npm trusted publishing with GitHub Actions OIDC.
That means:

- No `NPM_TOKEN` is required for `npm publish`
- `id-token: write` in the workflow is required
- Provenance is generated automatically for public packages published from this public repository

### 1. Configure npm Trusted Publishers

Create a trusted publisher entry on npmjs.com for each public package:

1. Open package settings for `@compdi/core`
2. Open **Trusted Publisher**
3. Add a GitHub Actions publisher with:
   - Owner: `franz-bendezu`
   - Repository: `compdi`
   - Workflow filename: `release.yml`
4. Repeat the same setup for `compdi`

These settings are managed on npmjs.com. The GitHub workflow cannot create them.

### 2. Verify GitHub Actions Permissions

The workflow already includes the required OIDC permission:

```yaml
permissions:
  contents: write
  id-token: write
```

Repository workflow permissions should still allow GitHub Actions to push the release commit and tag.

### 3. Public Repo Requirement

Because this repository is public and the published packages are public, npm can generate provenance attestations automatically when trusted publishing succeeds.

## Running the Workflow

### Manual Trigger with Dry Run

```bash
# Go to: Actions → Release & Publish → Run workflow
# Select: 
#   - version-bump: patch (or minor/major)
#   - dry-run: true
```

This will:
✓ Verify build succeeds
✓ Verify typecheck passes
✓ Verify distribution files exist
✓ Bump package versions for the release
✓ **Simulate** publication without actually publishing

### Full Release

```bash
# Go to: Actions → Release & Publish → Run workflow
# Select:
#   - version-bump: patch (or minor/major)
#   - dry-run: false
```

This will:
✓ Run full validation
✓ Bump versions across the workspace
✓ Publish @compdi/core to npm (public)
✓ Publish compdi to npm (public)
✓ Create git tag (v0.2.0, etc.)
✓ Create GitHub Release
✓ Verify npm registry

## What This Workflow Already Does

1. **OIDC publish permissions**
   - Includes `id-token: write` for npm trusted publishing

2. **Validation before publish**
   - Runs build and typecheck
   - Verifies expected dist files exist

3. **Release traceability**
   - Commits version bumps
   - Creates a git tag
   - Creates a GitHub Release
   - Verifies the published npm versions

### ⚠️ Additional Security Measures

If you want extra protection:

```yaml
# Add to workflow to require approval
environment:
  name: npm-release
  protection-rules:
    - required-reviewers: 1  # Requires manual approval
```

## Troubleshooting

### "ENEEDAUTH" or publish authentication errors

**Check**:
- The npm package has a trusted publisher configured
- The trusted publisher repository is `franz-bendezu/compdi`
- The workflow filename is exactly `release.yml`
- The workflow still has `id-token: write`

### Publish succeeds locally but fails in GitHub Actions

**Check**:
- The trusted publisher was configured on npm for both `@compdi/core` and `compdi`
- The package metadata and repository settings still match the public GitHub repository

### Provenance or Rekor transient failure

This usually indicates an upstream transparency log issue rather than a package configuration issue. Re-run the workflow after confirming the version was not already published.

### Workflow doesn't trigger

**Verify**:
- Go to **Settings** → **Actions** → **General**
- Check "Workflow permissions" are set to "Read and write"

## Public vs Private Packages

Your monorepo has:

### Public Packages (npm registry)
- `@compdi/core` - Type-safe DI macros
- `compdi` - Metapackage with unified API

### Not Published By This Workflow
- `unplugin-compdi` - Build plugin (not published by this workflow)

This workflow currently publishes only `@compdi/core` and `compdi`.
