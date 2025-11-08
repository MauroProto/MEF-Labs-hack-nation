# GitHub Actions & CI Configuration

This directory contains GitHub Actions workflows and CI/CD configuration for the Research Agent Canvas project.

## Files

### `workflows/ci.yml`
Main CI pipeline that runs on every push and pull request.

**What it does**:
- ✅ Installs dependencies
- ✅ Runs TypeScript type checking
- ✅ Runs ESLint
- ✅ Builds the application
- ✅ Validates Prisma schema
- ✅ Checks for prohibited `any` types
- ✅ Comments on PRs with results

**Trigger Events**:
- `push` to `main` or `Phase2`
- `pull_request` to `main` or `Phase2`

**Jobs** (run in parallel):
1. `build` - Full build check (10-15 min)
2. `type-safety` - TypeScript strict mode (5-10 min)
3. `prisma` - Database schema validation (5-10 min)
4. `dependencies` - Dependency security check (5 min)
5. `summary` - Final status & PR comments (1 min)

## Quick Start

### Local Testing

Test CI locally before pushing:

```bash
# Linux/macOS
./scripts/test-ci.sh

# Windows
scripts\test-ci.bat
```

### Pre-Commit Hooks

Hooks run automatically before commits:

```bash
# Stage changes
git add .

# Commit (hooks run automatically)
git commit -m "Your message"

# If hooks fail:
# 1. Fix the issues shown
# 2. Stage fixed files
# 3. Try commit again
```

To bypass hooks (NOT RECOMMENDED):
```bash
git commit -m "msg" --no-verify
```

## CI Status

### View CI Results

1. **GitHub Web**: Go to Actions tab → Select workflow run
2. **PR Comments**: CI will auto-comment with results table
3. **Locally**: Run `scripts/test-ci.sh` or `scripts/test-ci.bat`

### Interpreting Results

| Icon | Meaning |
|------|---------|
| ✅ | Check passed |
| ❌ | Check failed (must fix) |
| ⏭️ | Skipped (usually OK) |

## Common Issues & Fixes

### 1. Frozen Lockfile Error

**Error**:
```
pnpm ERR! Cannot install dependencies with --frozen-lockfile
```

**Cause**: `package.json` changed but `pnpm-lock.yaml` wasn't updated

**Fix**:
```bash
pnpm install
git add pnpm-lock.yaml
git commit --amend
git push
```

### 2. TypeScript Error

**Error**:
```
error TS2339: Property 'x' does not exist on type 'Y'
```

**Fix**:
```bash
# Check locally
pnpm type-check

# Fix the issue
# Edit the file to match type definitions

# Try again
pnpm type-check
```

### 3. Build Failure

**Error**:
```
Error building frontend/...
Error building backend/...
```

**Fix**:
```bash
# Clean and rebuild locally
pnpm clean
pnpm install
pnpm build

# Check for errors in output
# Fix and commit
```

### 4. ESLint Violations

**Error**:
```
error: 'x' is defined but never used (no-unused-vars)
```

**Fix**:
```bash
# Auto-fix what can be fixed
pnpm lint --fix

# Manually fix remaining issues
# Commit changes
```

### 5. Prisma Schema Error

**Error**:
```
Validation error in schema.prisma:X:Y
```

**Fix**:
```bash
# Validate schema
cd backend
pnpm prisma validate

# Fix any errors
# Create migration if needed
pnpm prisma migrate dev

# Commit changes
```

## Permissions

The workflow has these GitHub permissions:

```yaml
permissions:
  contents: read       # Read repository content
  checks: write        # Create check runs
  pull-requests: write # Comment on PRs
```

These are minimal and safe - no write access to main branch.

## Configuration Details

### Environment
- **Node.js**: 20.x (LTS)
- **Package Manager**: pnpm 9.15.0
- **Runner**: ubuntu-latest
- **Timeout**: 15 minutes per job

### Caching
- pnpm's dependency cache enabled
- Significantly speeds up subsequent runs

### Parallelization
All jobs run simultaneously (except summary):
```
build
type-safety
prisma
dependencies
↓
summary
```

## Debugging CI Issues

### View Full Logs

1. Go to **Actions** tab on GitHub
2. Click the failed workflow run
3. Expand the failed job
4. View complete log output

### Run Locally

```bash
# Exact CI command
pnpm install --frozen-lockfile
pnpm type-check
pnpm lint
pnpm build
cd backend && pnpm prisma validate
```

### Compare with Local Environment

```bash
# Check your local setup
node --version   # Should be 20+
pnpm --version   # Should be 9.15.0

# Clean install
pnpm clean
rm -rf node_modules
pnpm install

# Full check
pnpm build && pnpm type-check && pnpm lint
```

## Future Enhancements

Potential additions to CI:

- [ ] Unit test execution & coverage
- [ ] Performance benchmarks
- [ ] Security scanning (dependencies, secrets)
- [ ] Code quality metrics (SonarQube)
- [ ] Automatic deployment to staging
- [ ] Status badges in README

## Questions?

Check the main [CI_PIPELINE.md](../CI_PIPELINE.md) for comprehensive documentation.

---

**Last Updated**: 2025-11-08
**Maintained By**: Engineering Team
