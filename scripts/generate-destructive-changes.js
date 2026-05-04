#!/usr/bin/env node
/**
 * Generates a destructiveChanges.xml for deleted Apex classes in a PR.
 *
 * Usage:  node scripts/generate-destructive-changes.js <base-branch> <output-file>
 *   e.g.  node scripts/generate-destructive-changes.js origin/main destructiveChanges.xml
 *
 * Exits with code 0 and writes the file if deletions are found.
 * Exits with code 0 and writes nothing if no deletions are found.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const baseBranch = process.argv[2] || 'origin/main';
const outputFile = process.argv[3] || 'destructiveChanges.xml';
const repoRoot = path.resolve(__dirname, '..');

const sfdxProject = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'sfdx-project.json'), 'utf8')
);
const apiVersion = sfdxProject.sourceApiVersion || '66.0';

// Get deleted .cls files only
let deletedFiles;
try {
  deletedFiles = execSync(`git diff --name-only --diff-filter=D ${baseBranch}...HEAD`, {
    cwd: repoRoot,
  })
    .toString()
    .trim()
    .split('\n')
    .filter((f) => f.endsWith('.cls'));
} catch {
  console.error('ERROR: Could not run git diff.');
  process.exit(1);
}

if (!deletedFiles.length || (deletedFiles.length === 1 && deletedFiles[0] === '')) {
  console.log('No deleted Apex classes detected — skipping destructive changes.');
  process.exit(0);
}

const classNames = deletedFiles.map((f) => path.basename(f, '.cls'));
console.log('Deleted classes detected:', classNames.join(', '));

const members = classNames.map((name) => `        <members>${name}</members>`).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
${members}
        <name>ApexClass</name>
    </types>
    <version>${apiVersion}</version>
</Package>
`;

fs.writeFileSync(path.join(repoRoot, outputFile), xml, 'utf8');
console.log(`Written: ${outputFile}`);
