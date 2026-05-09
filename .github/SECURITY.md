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
              • npm publish (with secret token)
              • Create git tag
              • Create GitHub Release
                ↓
            [Verification Phase]
              • Query npm registry
              • Confirm publication
```

## Token Management Strategy

### Token Type Comparison

| Aspect | Classic Token | Automation Token |
|--------|---------------|------------------|
| Scope Control | ✓ Yes | ✓ Yes (stricter) |
| Expiration | Manual revocation | Auto-expires |
| Rotation | Manual | Automatic |
| Cost | Free | Free |
| **Recommended** | ❌ No | ✅ YES |

### Recommended Setup

1. **Create Automation Token** (preferred)
   - Expires automatically (reduces breach window)
   - Simpler management
   - Better for CI/CD

2. **Store in GitHub Secrets**
   - Encrypted at rest
   - Only accessible in Actions workflows
   - Never visible in logs

3. **Use only for Publishing**
   - Don't use for local development
   - Use `npm login` for local work

## Security Features of Your Workflow

### 1. Encryption & Access Control

```yaml
env:
  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

✓ Token is encrypted in GitHub Secrets
✓ Only accessible in workflow run context
✓ Never logged to console
✓ Masked in workflow logs

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
# ❌ NEVER hardcode tokens
env:
  NPM_TOKEN: "npm_xxxxxxxxxxxx"

# ❌ NEVER log the token
run: echo $NPM_TOKEN

# ❌ NEVER commit tokens to git
# (even if you revoke them later, history is still there)

# ❌ NEVER use personal tokens in shared CI
# (use service account or automation tokens)
```

### ✓ DO

```yaml
# ✓ Use GitHub Secrets
env:
  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

# ✓ GitHub automatically masks secret values
# (they appear as *** in logs)

# ✓ Use Automation tokens
# (auto-expiring, scoped permissions)

# ✓ Rotate tokens regularly
# (set calendar reminder every 6 months)

# ✓ Minimize token scope
# (only "Publish" permission if available)
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

## Vulnerability Scanning

### Add Dependency Check

```yaml
- name: Security audit
  run: npm audit --audit-level=moderate
  # Fails if vulnerabilities found

- name: SBOM generation (optional)
  run: npm sbom --workspace packages/core
  # Creates software bill of materials
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

# Publish a new patch version
npm publish --workspace packages/core --access public
npm publish --workspace packages/compdi --access public
```

## Regular Maintenance

### Monthly
- [ ] Check npm account security
- [ ] Review GitHub Actions logs
- [ ] Look for security advisories

### Quarterly
- [ ] Run `npm audit` and fix vulnerabilities
- [ ] Review token expiration dates
- [ ] Update GitHub Actions versions

### Bi-annually
- [ ] Rotate npm token
- [ ] Review workflow permissions
- [ ] Audit GitHub repository settings

## Emergency Response

If token is compromised:

1. **Immediate**
   ```bash
   # Revoke compromised token on npmjs.com
   # (Settings → Tokens → Delete token)
   ```

2. **Short term**
   ```bash
   # Create new token with same name
   # Update GitHub Secret
   ```

3. **Follow-up**
   ```bash
   # Check npm audit log
   # Review GitHub Actions runs
   # Look for unauthorized publishes
   ```

## Questions & Support

For help:
- npm docs: https://docs.npmjs.com/
- GitHub Actions: https://docs.github.com/en/actions
- npm token management: https://npmjs.com/settings/your-username/tokens
