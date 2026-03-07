#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * test_inventory_parser.js - High-Grade Test Inventory Script
 * Replaces fragile grep counting in Phase 0 of /test-evolve
 */

const targetDir = process.argv[2] || process.cwd();

function countTestCases(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let cases = 0;
    let suites = 0;

    lines.forEach(line => {
        const trimmed = line.trim();
        // Match standard JS/TS test definitions: it('...'), test('...'), test.skip('...')
        if (trimmed.match(/^(it|test)(\.(skip|only))?\s*\(/)) {
            cases++;
        }
        if (trimmed.match(/^describe(\.(skip|only))?\s*\(/)) {
            suites++;
        }
    });
    return { cases, suites };
}

function findTestFiles(dir, fileList = { testFiles: [], sourceFiles: [] }) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file.startsWith('.') || file === 'dist' || file === 'build') continue;
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            findTestFiles(filePath, fileList);
        } else {
            if (file.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/)) {
                fileList.testFiles.push(filePath);
            } else if (file.match(/\.(ts|tsx|js|jsx)$/)) {
                fileList.sourceFiles.push(filePath);
            }
        }
    }
    return fileList;
}

console.log(`📊 High-Grade Test Inventory Analysis: ${targetDir}`);
const inventory = findTestFiles(targetDir);

let totalCases = 0;
let totalSuites = 0;

inventory.testFiles.forEach(file => {
    const counts = countTestCases(file);
    totalCases += counts.cases;
    totalSuites += counts.suites;
});

console.log(`\n--- Test Asset Metrics ---`);
console.log(`Total Source Files:  ${inventory.sourceFiles.length}`);
console.log(`Total Test Files:    ${inventory.testFiles.length}`);
console.log(`Total Test Suites:   ${totalSuites}`);
console.log(`Total Test Cases:    ${totalCases}`);

if (inventory.sourceFiles.length > 0) {
    const rawCoverage = (inventory.testFiles.length / inventory.sourceFiles.length) * 100;
    console.log(`File Test Ratio:     ${rawCoverage.toFixed(1)}%`);
}

process.exit(0);
