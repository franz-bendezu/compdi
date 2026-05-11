# Security Best Practices for npm Publishing

## Recommended Workflow Security Architecture

```
Developer Push → GitHub Actions
                ↓
            [Validation Phase]
              • Build check
              • Type check
              • Integrity verification
                ↓
            [Approval Phase] (optional)
              • Manual approval required
                ↓
            [Publish Phase]
              • npm publish via npm trusted publisher
              • Create git tag
              • Create GitHub Release
                ↓
            [Verification Phase]
              • Query npm registry
              • Confirm publication
```

## Authentication Strategy

This repository is public and should publish through npm trusted publishers.

Required pieces:

1. npm trusted publisher configured for `@compdi/core`
2. npm trusted publisher configured for `compdi`
3. GitHub Actions workflow permission `id-token: write`

The GitHub workflow can mint the OIDC token, but npm trusted publisher entries still have to be configured on npmjs.com.

## Security Features of Your Workflow

### 1. OIDC-Based Publish Authentication

```yaml
permissions:
  id-token: write
```

✓ No long-lived npm publish token is required
✓ GitHub Actions mints a short-lived OIDC token for the workflow
✓ npm validates the workflow identity against the trusted publisher settings

### 2. Validation Gates

```yaml
- name: Run build
  run: npm run build

- name: Run typecheck
  run: npm run typecheck

- name: Validate package integrity
  run: # checks that dist files exist
```

✓ Publication only happens if all checks pass
✓ Prevents accidental publication of broken code
✓ Type safety guaranteed

### 3. Audit Trail

Every publication has:
- **GitHub Actions Log**: Full audit trail
- **Git Tag**: Version tracking
- **GitHub Release**: Documentation
- **npm Registry**: Publication history
- **Provenance Attestation**: Generated automatically for public packages from this public repository

```bash
# Check publication history
npm info @compdi/core
npm info compdi
```

### 4. Dry Run Mode

```yaml
- name: Publish to npm (Dry Run)
  if: ${{ inputs.dry-run == true }}
  run: echo "Would publish..."
```

✓ Test workflow without publishing
✓ Verify all checks pass
✓ Catch configuration issues early

## Preventing Common Mistakes

### ❌ DO NOT

```yaml
# ❌ Don't mismatch the trusted publisher workflow filename
# npm expects exactly: release.yml

# ❌ Don't remove id-token: write

# ❌ Don't assume configuring GitHub alone enables trusted publishing
# npm package settings must also be configured
```

### ✓ DO

```yaml
# ✓ Keep the repository public

# ✓ Keep the workflow filename stable

# ✓ Keep id-token: write on the release workflow

# ✓ Configure trusted publishers for each public package on npmjs.com
```

## Enhanced Security Configuration (Optional)

### Add Approval Requirement

```yaml
# In .github/workflows/release.yml
jobs:
  release:
    # Requires manual approval before publishing
    environment:
      name: npm-release
    runs-on: ubuntu-latest
```

Then in GitHub:
1. Settings → Environments → Create "npm-release"
2. Add required reviewers
3. Any release attempt will await approval

### Sign Commits (Optional)

```yaml
- name: Configure Git (with signing)
  run: |
    git config --local user.email "$(gh api user --jq .email)"
    git config --local user.name "GitHub Actions"
    # If you have GPG setup:
    git config --local user.signingkey "${{ secrets.GPG_KEY }}"
```

### Snapshot Before Publishing

```yaml
- name: Create pre-release snapshot
  run: |
    git stash
    npm pack --workspace packages/core
    npm pack --workspace packages/compdi
    # Store artifacts before publishing
```

## monitoring & Alerts

### Check Publication Status

```bash
# Verify latest version
npm view compdi version

# Check publication history
npm info compdi
npm info @compdi/core

# View package details
npm view compdi --json
```

### Set Up npm Alerts (npmjs.com)

1. Profile → Settings → Security
2. Enable email notifications for:
   - Package publication
   - Dependency updates
   - Security advisories

## Rollback Plan

If a bad version is published:

```bash
# Deprecate the bad version
npm deprecate @compdi/core@0.2.0 "Use 0.2.1 instead"
npm deprecate compdi@0.2.0 "Use 0.2.1 instead"

# Trigger a new patch release through the release workflow
# and publish the fixed version from GitHub Actions
```

## Questions & Support

For help:
- npm docs: https://docs.npmjs.com/
- GitHub Actions: https://docs.github.com/en/actions
- npm trusted publishers: https://docs.npmjs.com/trusted-publishers
