# CI/CD Pipeline Documentation

This document explains the Continuous Integration pipeline configured for the Research Agent Canvas project.

**Last Updated**: 2025-11-08
**Status**: ✅ Active

---

## Overview

The CI pipeline runs automatically on:
- **Push to**: `main`, `Phase2` branches
- **Pull Requests to**: `main`, `Phase2` branches

The pipeline checks:
1. ✅ **Build Check** - Compiles code to catch syntax errors
2. ✅ **Type Safety** - Ensures TypeScript strict mode compliance
3. ✅ **Prisma Schema** - Validates database schema
4. ✅ **Dependencies** - Checks for outdated/duplicate packages
5. ✅ **Local Hooks** - Pre-commit checks before git commit

---

## GitHub Actions Workflow

### File Location
`.github/workflows/ci.yml`

### Workflow Jobs

#### 1. **Build Check** (10-15 minutes)
**What it does**:
- Installs dependencies with `pnpm install --frozen-lockfile`
- Runs `pnpm type-check` - TypeScript compilation
- Runs `pnpm lint` - ESLint checks
- Runs `pnpm build` - Full application build

**Triggers failure if**:
- Any TypeScript compilation errors
- ESLint violations found
- Build fails for frontend or backend
- Dependencies cannot be resolved

**Example failure**:
```
❌ Build failed
Error: Backend has TypeScript errors
  src/services/debateOrchestrator.ts:42:10 - error TS2339:
  Property 'conversationTurns' does not exist on type 'InvocationContext'
```

---

#### 2. **Type Safety Check** (5-10 minutes)
**What it does**:
- Scans for prohibited `any` types (except allowed patterns like `Record<string, any>`)
- Verifies TypeScript strict mode is enabled
- Reports type safety violations

**Triggers failure if**:
- New `any` types introduced outside approved patterns
- Strict mode disabled

**Example check**:
```typescript
// ❌ PROHIBITED - will fail CI
function processData(input: any): any {
  return input;
}

// ✅ ALLOWED - passes CI
function processData(config: Record<string, any>): DebateSession {
  return config as DebateSession;
}
```

**Exception Patterns**:
- `Record<string, any>` - Allowed (common for JSON config)
- `data: any` - Allowed (database query results)

---

#### 3. **Prisma Schema Validation** (5-10 minutes)
**What it does**:
- Validates `backend/prisma/schema.prisma` syntax
- Generates Prisma Client from schema
- Ensures no breaking schema changes

**Triggers failure if**:
- Prisma schema has syntax errors
- Invalid relationships between models
- Incompatible field type changes
- Prisma client generation fails

**Example error**:
```
Error: Validation error in schema.prisma:8:3
Field `author` has a `@relation` but no `authorId` foreign key field.
```

---

#### 4. **Dependency Check** (5 minutes)
**What it does**:
- Lists outdated dependencies (informational)
- Verifies lockfile integrity
- Checks for duplicate dependencies

**Triggers failure if**:
- Critical security vulnerabilities in dependencies
- Lockfile is corrupted
- Dependency conflicts unresolved

**Example output**:
```
✅ pnpm install --frozen-lockfile successful
✅ No duplicate dependencies found
```

---

#### 5. **Summary & PR Comment** (1 minute)
**What it does**:
- Reports final status of all checks
- Comments on PR with results table
- Blocks merge if any check failed

**PR Comment Example**:
```
✅ CI Check Results

| Check | Status |
|-------|--------|
| Build | ✅ Passed |
| Type Safety | ✅ Passed |
| Prisma Schema | ✅ Passed |

🎉 All checks passed! This PR is ready to merge.
```

---

## Local Pre-Commit Hook

### File Location
`.husky/pre-commit`

### What it Checks Before Commit

1. **Lint-Staged** - Fixes formatting issues in staged files
   ```bash
   *.ts,*.tsx  → eslint --fix + prettier --write
   *.js,*.jsx  → eslint --fix + prettier --write
   *.json,*.md → prettier --write
   ```

2. **Any Type Detection** - Warns about `any` types
   ```bash
   # Checks staged TS files for ": any" patterns
   # Allows Record<string, any> and data: any
   # Warns user but allows commit with confirmation
   ```

3. **Git Lifecycle** - Runs when you execute `git commit`

### Running Pre-Commit Checks

Pre-commit hooks run automatically:
```bash
git commit -m "Add debate orchestrator service"
# Runs hooks automatically
```

To skip hooks (NOT RECOMMENDED):
```bash
git commit -m "msg" --no-verify
```

To manually run hooks:
```bash
# Run lint-staged manually
pnpm lint-staged

# Run type check
pnpm type-check

# Run full lint
pnpm lint
```

---

## Lint-Staged Configuration

### File Location
`package.json` - `lint-staged` section

### Configuration
```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

### How It Works
1. Git determines what files are staged
2. `lint-staged` filters files by pattern
3. Runs commands on matching files
4. If any command fails, blocks commit
5. Successfully modified files are re-staged

### Example
```bash
# Stage multiple files
git add backend/src/services/*.ts
git add frontend/components/*.tsx

# Commit triggers:
$ git commit -m "Refactor agents"
🔧 Running lint-staged...
  eslint --fix backend/src/services/debateOrchestrator.ts
  prettier --write backend/src/services/debateOrchestrator.ts
  eslint --fix frontend/components/DebatePanel.tsx
  prettier --write frontend/components/DebatePanel.tsx
✅ Pre-commit checks passed!
```

---

## Build Scripts

### Running Checks Manually

#### Full Type Check & Build
```bash
# Type check all workspaces
pnpm type-check

# Lint all workspaces
pnpm lint

# Build all workspaces
pnpm build

# Clean build artifacts
pnpm clean
```

#### Frontend Only
```bash
cd frontend

# Type check
pnpm type-check

# Lint
pnpm lint

# Build
pnpm build

# Dev server
pnpm dev
```

#### Backend Only
```bash
cd backend

# Type check
pnpm type-check

# Lint
pnpm lint

# Build
pnpm build

# Dev server with watch
pnpm dev

# Prisma commands
pnpm prisma validate      # Validate schema
pnpm prisma generate      # Generate client
pnpm prisma migrate dev   # Create migration
pnpm prisma studio       # Open database UI
```

---

## Common CI Failures & Fixes

### 1. **TypeScript Compilation Error**

**Error Message**:
```
error TS2339: Property 'xyz' does not exist on type 'ABC'
```

**Fix**:
1. Check the type definition in relevant `.ts` file
2. Verify interface extends correctly
3. Run `pnpm type-check` locally
4. Fix the type error
5. Commit and push

**Example**:
```typescript
// ❌ Error: InvocationContext doesn't have conversationTurns
context.conversationTurns = new Map();

// ✅ Fix: Update InvocationContext interface in agent.types.ts
export interface InvocationContext {
  conversationTurns: Map<string, number>;
  // ... other fields
}
```

---

### 2. **ESLint Violations**

**Error Message**:
```
error: 'unused' is defined but never used (no-unused-vars)
```

**Fix**:
1. Run `pnpm lint --fix` to auto-fix many issues
2. Manually fix remaining issues
3. Understand the rule and why it's enforced

**Example**:
```typescript
// ❌ ESLint error: imported but never used
import { unused } from './lib';

// ✅ Fix: Remove unused import or use it
import { debateOrchestrator } from './lib';
const result = debateOrchestrator.invoke();
```

---

### 3. **Prisma Schema Error**

**Error Message**:
```
Validation error in schema.prisma:42:5
Field `targetPosture` has a `@relation` but no foreign key field found.
```

**Fix**:
1. Check the Prisma schema syntax
2. Ensure all relations have foreign key fields
3. Run `pnpm prisma validate` locally
4. Fix schema issues
5. Create migration: `pnpm prisma migrate dev`

**Example**:
```prisma
// ❌ Error: @relation without foreign key
model DebateRound {
  targetPosture   Posture? @relation(fields: [targetPostureId])
  // Missing: targetPostureId field!
}

// ✅ Fix: Add foreign key field
model DebateRound {
  targetPostureId String?
  targetPosture   Posture? @relation(fields: [targetPostureId], references: [id])
}
```

---

### 4. **Dependency Conflict**

**Error Message**:
```
pnpm ERR! Dependency conflict: package xyz has conflicting versions
```

**Fix**:
1. Run `pnpm install` to resolve
2. If persists, check `pnpm-lock.yaml` for conflicts
3. Run `pnpm install --force` as last resort
4. Check for incompatible package versions

---

### 5. **Frozen Lockfile Error**

**Error Message**:
```
pnpm ERR! Cannot install dependencies with `--frozen-lockfile`
```

**This means**: Someone modified `package.json` without updating `pnpm-lock.yaml`

**Fix**:
```bash
# Update lockfile locally
pnpm install

# This updates pnpm-lock.yaml
# Then commit and push
git add pnpm-lock.yaml
git commit -m "Update lockfile"
git push
```

---

## Performance Optimization

### Caching Strategy
The GitHub Actions workflow uses pnpm's built-in caching:
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'pnpm'  # Automatically caches node_modules
```

**Result**: Subsequent runs are 50-70% faster

### Parallel Execution
Jobs run in parallel (except summary):
```
├── Build Check
├── Type Safety
├── Prisma Validation
└── Dependency Check
    ↓
    Summary & PR Comment
```

**Total Time**: 10-15 minutes (vs 30+ if sequential)

---

## Monitoring & Alerts

### Check CI Status
1. **On GitHub**: View workflow runs in Actions tab
2. **In PR**: Check "Checks" section
3. **Locally**: Run `pnpm build && pnpm type-check`

### Failed Workflow Recovery
1. Check the failed job logs
2. Fix issues locally
3. Commit and push
4. GitHub automatically re-runs workflow

### Secrets & Credentials
- No secrets stored in CI (not needed for build check)
- Database connection is optional for build phase
- Prisma client generation works without database

---

## GitHub Actions Configuration

### Permissions
```yaml
permissions:
  contents: read          # Can read repo content
  checks: write          # Can create check runs
  pull-requests: write   # Can comment on PRs
```

### Timeout
- Individual jobs: 10-15 minutes max
- Default: 6 hours (job will timeout if not finished)

### Node Version
- **Latest LTS**: 20.x (matching `package.json` engines)
- Can be matrix-tested in future

---

## Troubleshooting

### Debug CI Locally

Run the exact same commands CI runs:
```bash
# 1. Clean install
pnpm clean
pnpm install --frozen-lockfile

# 2. Type check
pnpm type-check

# 3. Lint
pnpm lint

# 4. Build
pnpm build

# 5. Prisma check
cd backend
pnpm prisma validate
pnpm prisma generate
```

### View Full CI Logs
1. Go to GitHub Actions tab
2. Click the failed workflow run
3. Expand the failed job step
4. View complete logs

### Contact & Support
- Check CI logs first
- Review this documentation
- Ask team for similar issues they've solved
- Create GitHub issue if it's a genuine infrastructure problem

---

## Future Enhancements

Potential additions to CI pipeline:

1. **Test Coverage**
   - Unit tests with Jest
   - Coverage thresholds (e.g., >80%)
   - Coverage reports

2. **Performance Benchmarks**
   - Bundle size tracking
   - Build time tracking
   - Regression alerts

3. **Security Scanning**
   - Dependency vulnerability scanning
   - SAST (Static Application Security Testing)
   - Secret detection

4. **Deployment Gates**
   - Auto-deploy to staging on PR merge
   - Slack/Discord notifications
   - Status badges in README

5. **Code Quality**
   - SonarQube integration
   - Code complexity analysis
   - Duplication detection

---

## Summary

| Check | Trigger | Time | What Fails |
|-------|---------|------|-----------|
| Build | Push/PR | 10-15m | TypeScript, ESLint, build errors |
| Type Safety | Push/PR | 5-10m | `any` types, strict mode violations |
| Prisma | Push/PR | 5-10m | Schema syntax, invalid relations |
| Dependencies | Push/PR | 5m | Security issues, lockfile corruption |
| Pre-commit | Before commit | 2-5m | Format issues, staging errors |

**Result**: Code quality maintained, errors caught early, team stays productive! 🚀

---

**Last Updated**: 2025-11-08
**Maintained By**: Engineering Team
**Issues**: Report in GitHub Issues
