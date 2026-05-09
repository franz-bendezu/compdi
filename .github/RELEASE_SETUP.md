# GitHub Actions Release Configuration

## Setup Instructions

### 1. Create NPM Automation Token (Recommended)

The most secure way to publish packages is using an npm **Automation Token**:

1. Go to [npmjs.com](https://www.npmjs.com/settings/franz-bendezu/tokens)
2. Click "Create Token" → Select **"Automation"** type
3. Name it: `github-actions-ci`
4. **Important**: This token type has restricted permissions and expires regularly

### 2. Alternative: Generate Classic Token

If automation tokens are unavailable:

1. Go to [npmjs.com Settings](https://www.npmjs.com/settings/franz-bendezu/tokens)
2. Click "Create Token" → Select **"Read and Publish"**
3. Name it descriptively: `github-actions-release`
4. **Security considerations**:
   - Use the most restrictive scope possible
   - Enable 2FA on your npm account
   - Rotate tokens regularly (every 6 months)

### 3. Add Token to GitHub Secrets

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Name: `NPM_TOKEN`
4. Value: Paste your npm token
5. Click **"Add secret"**

### 4. Enable Workflow Permissions

1. Repository → **Settings** → **Actions** → **General**
2. Under **Workflow permissions**:
   - Select: **"Read and write permissions"**
   - Enable: **"Allow GitHub Actions to create and approve pull requests"**

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
✓ Publish @compdi/core to npm (public)
✓ Publish compdi to npm (public)
✓ Create git tag (v0.2.0, etc.)
✓ Create GitHub Release
✓ Verify npm registry

## Security Best Practices

### ✓ What Your Workflow Does Right

1. **Token Security**
   - Stores token in GitHub Secrets (encrypted)
   - Never logs the token
   - Uses `${{ secrets.NPM_TOKEN }}` safely

2. **Validation Before Publish**
   - Runs `npm run build` to verify code compiles
   - Runs `npm run typecheck` to verify types
   - Validates distribution files exist
   - All checks must pass before publishing

3. **Access Control**
   - Only public packages are published
   - Private packages are protected by `"private": true` in package.json
   - Token is only used in release workflow

4. **Audit Trail**
   - GitHub Actions logs all steps
   - Git tags track releases
   - GitHub Releases provide documentation
   - npm registry maintains publication history

### ⚠️ Additional Security Measures

If you want extra protection:

```yaml
# Add to workflow to require approval
environment:
  name: npm-release
  protection-rules:
    - required-reviewers: 1  # Requires manual approval
```

### 🔄 Token Rotation

Set a calendar reminder to rotate tokens every 6 months:

1. Generate new token on npm
2. Update GitHub Secret
3. Revoke old token on npm

## Troubleshooting

### "E403: You don't have permission to publish this package"

**Solution**: Token doesn't have publish permissions
- Verify token type is "Read and Publish" or "Automation"
- Regenerate token with correct permissions

### "E401: Unauthorized"

**Solution**: Token is invalid or expired
- Check token hasn't been revoked
- Verify it's correctly pasted in GitHub Secrets
- Regenerate and update if needed

### Workflow doesn't trigger

**Verify**:
- Go to **Settings** → **Actions** → **General**
- Check "Workflow permissions" are set to "Read and write"

## Publishing Manually (Alternative)

If you need to publish without CI/CD:

```bash
npm login  # Interactive login

# For development (never do this in CI without secrets)
npm publish --workspace packages/core --access public
npm publish --workspace packages/compdi --access public
```

## Public vs Private Packages

Your monorepo has:

### Public Packages (npm registry)
- `@compdi/core` - Type-safe DI macros
- `compdi` - Metapackage with unified API

### Private Packages (not published)
- `@compdi/shared` - Internal utilities (private: true)
- `unplugin-compdi` - Build plugin (private: true)

The workflow automatically handles this via the `private` field in package.json.
