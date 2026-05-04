#!/usr/bin/env node
/**
 * Resolves test classes to run based on Apex files changed in a PR.
 *
 * Discovery order per changed class:
 *   1. Convention — if <ClassName>Test.cls exists on disk, use it automatically.
 *   2. Manual mapping — fall back to test-class-mapping.json for non-standard names.
 *
 * Usage:  node scripts/resolve-tests.js <base-branch>
 *   e.g.  node scripts/resolve-tests.js origin/main
 *
 * Outputs a comma-separated list of test class names (or empty string if none found).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const baseBranch = process.argv[2] || 'origin/main';
const repoRoot = path.resolve(__dirname, '..');
const mappingFile = path.join(repoRoot, 'test-class-mapping.json');

// Discover all main/default/classes directories under each packageDirectory.
// Uses a recursive scan to handle non-standard nesting (e.g. force-app/force-app/...).
const sfdxProject = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'sfdx-project.json'), 'utf8')
);

function findClassesDirs(baseDir) {
  const results = [];
  if (!fs.existsSync(baseDir)) return results;
  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(baseDir, entry.name);
    const candidate = path.join(fullPath, 'main', 'default', 'classes');
    if (fs.existsSync(candidate)) {
      results.push(candidate);
    } else {
      results.push(...findClassesDirs(fullPath));
    }
  }
  return results;
}

const classesDirs = sfdxProject.packageDirectories.flatMap((pkg) =>
  findClassesDirs(path.join(repoRoot, pkg.path))
);

// Load manual mapping (optional override for non-conventional names)
const manualMapping = fs.existsSync(mappingFile)
  ? JSON.parse(fs.readFileSync(mappingFile, 'utf8'))
  : {};

// Get all changed .cls files in this PR
let allChangedCls;
try {
  allChangedCls = execSync(`git diff --name-only ${baseBranch}...HEAD`, { cwd: repoRoot })
    .toString()
    .trim()
    .split('\n')
    .filter((f) => f.endsWith('.cls'));
} catch {
  console.error('ERROR: Could not run git diff. Ensure fetch-depth: 0 in checkout step.');
  process.exit(1);
}

if (!allChangedCls.length || (allChangedCls.length === 1 && allChangedCls[0] === '')) {
  process.stdout.write('');
  process.exit(0);
}

const changedSourceClasses = allChangedCls.filter((f) => !f.endsWith('Test.cls'));
const changedTestClasses = allChangedCls.filter((f) => f.endsWith('Test.cls'));

const resolved = new Set();

// Directly changed test classes — always include them
for (const file of changedTestClasses) {
  resolved.add(path.basename(file, '.cls'));
}

// For each changed source class, resolve its test class
for (const file of changedSourceClasses) {
  const className = path.basename(file, '.cls');

  // 1. Convention: <ClassName>Test.cls exists in any package directory?
  const conventionalTest = `${className}Test`;
  if (classesDirs.some((dir) => fs.existsSync(path.join(dir, `${conventionalTest}.cls`)))) {
    resolved.add(conventionalTest);
    continue;
  }

  // 2. Manual mapping fallback
  if (manualMapping[className]) {
    resolved.add(manualMapping[className]);
    continue;
  }

  console.warn(`WARNING: No test class found for '${className}' — skipping.`);
}

// Fall back to defaults if nothing was resolved
if (resolved.size === 0 && Array.isArray(manualMapping._defaults)) {
  console.warn('No test classes resolved — falling back to defaults.');
  manualMapping._defaults.forEach((t) => resolved.add(t));
}

process.stdout.write([...resolved].join(','));
