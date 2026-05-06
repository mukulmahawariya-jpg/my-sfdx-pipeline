# CI/CD Pipeline Architecture

## Overview

This pipeline automates Salesforce Apex class validation and deployment using GitHub Actions and the Salesforce CLI (`sf`). It is designed to:

- Run **only the relevant test classes** for changed code — never the entire org test suite
- Handle **additions, modifications, and deletions** of Apex classes automatically
- Require **zero manual configuration** for classes that follow naming conventions
- Use **cached dependencies** to reduce workflow run time

---

## Workflow Files

### `validate-pr.yml` — Triggered on Pull Request to `main`
Performs a **dry-run deployment** (`--dry-run`) to validate the code without saving it to the org. Acts as a gate before merging.

### `deploy.yml` — Triggered on Push to `main` (after PR merge)
Performs the **actual deployment** to the target org. Identical logic to `validate-pr.yml` minus `--dry-run`.

---

## Key Components

### 1. `test-class-mapping.json`

Single source of truth for test class configuration.

```json
{
  "_defaults": ["HelloWorldTest"],
  "HelloWorld": ["HelloWorldTest"],
  "OrderService": ["OrderServiceTest", "OrderServiceIntegrationTest"]
}
```

| Key | Purpose |
|---|---|
| `_defaults` | Test classes that run when no specific tests are resolved (smoke tests) |
| `"ClassName": "TestClass"` | Single test class override (string) |
| `"ClassName": ["TestA", "TestB"]` | Multiple test classes override (array) |

**You only need to add entries here for non-standard naming.** If your test class follows the `<ClassName>Test` convention and the file exists on disk, it is auto-discovered. For classes that require multiple test classes, use the array form.

---

### 2. `scripts/resolve-tests.js`

Resolves which test classes to run based on changed Apex files in the PR/push.

**Discovery order for each changed source class:**

```
1. Convention check
   └─ Does <ClassName>Test.cls exist on disk in any packageDirectory?
      YES → use it automatically
      NO  ↓

2. Manual mapping
   └─ Is there an entry in test-class-mapping.json?
      YES → use the mapped test class(es) — string or array both supported
      NO  ↓

3. Warning — class skipped

After all classes resolved:
4. Defaults fallback
   └─ resolved set is empty? → use _defaults from test-class-mapping.json
```

**Package directory discovery:**

The script reads `sfdx-project.json` and recursively scans each `packageDirectory` for `main/default/classes` directories. This handles non-standard nesting (e.g. `force-app/force-app/main/default/classes`).

**Output:** Comma-separated test class names written to stdout. Used directly by the workflow.

---

### 3. `scripts/generate-destructive-changes.js`

Detects deleted Apex classes in the PR/push and generates the `destructiveChanges.xml` required by Salesforce for class removal.

**Process:**

```
git diff --diff-filter=D <base>...HEAD
        ↓
Filter for .cls files
        ↓
Write destructiveChanges.xml with deleted class names
        ↓
Write empty package.xml (required by sf CLI as --manifest for destructive-only deployments)
```

**Output XML format:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>DummyService</members>
        <members>DummyServiceTest</members>
        <name>ApexClass</name>
    </types>
    <version>66.0</version>
</Package>
```

Both files are generated at runtime on the GitHub Actions runner and are never committed to the repository.

---

## Deployment Decision Logic

The workflow evaluates three flags after scanning the diff:

| Variable | Source |
|---|---|
| `TEST_CLASSES` | Output of `resolve-tests.js` |
| `METADATA_FLAGS` | `git diff --diff-filter=ACM` — added/modified `.cls` files |
| `DESTRUCTIVE_FLAG` | Set if `destructiveChanges.xml` was generated |

```
METADATA_FLAGS set?
├── YES → Selective deploy
│         sf project deploy start
│           --metadata ApexClass:Foo
│           --metadata ApexClass:FooTest
│           --test-level RunSpecifiedTests
│           --tests FooTest
│           [--post-destructive-changes destructiveChanges.xml]  ← if also deleting
│
DESTRUCTIVE_FLAG set (only)?
├── YES → Destructive-only deploy
│         sf project deploy start
│           --manifest package.xml
│           --post-destructive-changes destructiveChanges.xml
│           --test-level RunSpecifiedTests
│           --tests <defaults>
│
Neither?
└── NO Apex changes → Skip deployment entirely
```

**Why selective deployment?**

Using `--metadata ApexClass:X` instead of deploying the full source ensures that Salesforce only checks 75% test coverage for the classes actually in the PR — not every class in the org.

**Why `--post-destructive-changes` (not pre)?**

Post-destructive ensures new code is deployed before old code is removed. This prevents a window where neither old nor new class exists in the org.

**Why `--tests` (repeated) instead of comma-separated?**

The current `sf` CLI expects `--tests ClassName` per class. The comma-separated syntax from the old `sfdx` CLI triggers a warning and may not run tests as expected.

---

## Dependency Caching

`@salesforce/cli` is installed as a `devDependency` in `package.json`. The workflows use `actions/setup-node` with `cache: 'npm'` so `node_modules` is restored from cache on every run where `package-lock.json` has not changed.

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'

- run: npm ci   # uses cache — skips download if package-lock.json unchanged
```

This replaces the previous `npm install -g @salesforce/cli` which re-downloaded the CLI on every single run (~1-2 min saved per run).

---

## Adding a New Apex Class

### Standard naming (`FooService.cls` + `FooServiceTest.cls`)

1. Create `FooService.cls` and `FooServiceTest.cls` in `force-app/force-app/main/default/classes/`
2. Commit and open a PR
3. Pipeline auto-discovers `FooServiceTest` by convention — **no config changes needed**

### Non-standard naming (`FooService.cls` tested by `FooSuite.cls`)

1. Create both class files
2. Add one entry to `test-class-mapping.json`:
   ```json
   { "FooService": ["FooSuite"] }
   ```
3. Commit and open a PR

### Multiple test classes (`FooService.cls` tested by `FooSuite.cls` and `FooIntegrationTest.cls`)

1. Create all class files
2. Add an array entry to `test-class-mapping.json`:
   ```json
   { "FooService": ["FooSuite", "FooIntegrationTest"] }
   ```
3. Commit and open a PR

---

## Deleting an Apex Class

1. `git rm` the `.cls` and `.cls-meta.xml` files
2. Commit and open a PR
3. `generate-destructive-changes.js` detects the deletion via `--diff-filter=D` and generates `destructiveChanges.xml` automatically
4. Pipeline deploys destructively — class is removed from the org on merge

---

## Diff Base Reference

| Workflow | Base ref | Reason |
|---|---|---|
| `validate-pr.yml` | `origin/${{ github.base_ref }}` | Compares PR branch against the target branch dynamically |
| `deploy.yml` | `${{ github.event.before }}` | The exact commit SHA before this push — captures only what changed in this merge |

---

## Repository Structure

```
.github/
  workflows/
    validate-pr.yml        # PR validation (dry-run)
    deploy.yml             # Production deployment

scripts/
  resolve-tests.js         # Resolves test classes from changed files
  generate-destructive-changes.js  # Generates destructiveChanges.xml for deletions

force-app/
  force-app/
    main/default/classes/  # Apex classes and test classes

test-class-mapping.json    # Manual overrides and default test classes
sfdx-project.json          # Salesforce project config (packageDirectories)
package.json               # @salesforce/cli as devDependency for caching
```
