#!/usr/bin/env node

/**
 * evolve.js - Self-Evolution Logic
 *
 * Analyzes usage data from USAGE_TRACKER.md, session_state.json,
 * and pattern files (.sweep_patterns.md, .test_evolution_patterns.md)
 * to propose improvements to the Antigravity system.
 *
 * Usage:
 *   node evolve.js            # Full report
 *   node evolve.js --checkout # Silent mode (only critical suggestions)
 */

const fs = require('fs');
const path = require('path');

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const TRACKER_FILE = path.join(ANTIGRAVITY_DIR, 'USAGE_TRACKER.md');

// Thresholds
const UNUSED_DAYS_THRESHOLD = 30;
const HIGH_USAGE_THRESHOLD = 50;

function readTracker() {
    if (!fs.existsSync(TRACKER_FILE)) return null;
    const content = fs.readFileSync(TRACKER_FILE, 'utf8');
    const lines = content.split('\n');
    const usage = [];

    let inTable = false;
    for (const line of lines) {
        if (line.includes('| Workflow | Count |')) {
            inTable = true;
            continue;
        }
        if (inTable && line.startsWith('|') && !line.includes('---')) {
            const parts = line.split('|').map(p => p.trim()).filter(p => p);
            if (parts.length >= 3) {
                usage.push({
                    workflow: parts[0],
                    count: parseInt(parts[1], 10),
                    lastUsed: parts[2] === '-' ? null : parts[2]
                });
            }
        }
    }
    return usage;
}

function analyzeUsage(usageData) {
    const now = new Date();
    const unused = [];
    const highUsage = [];
    const suggestions = [];

    usageData.forEach(item => {
        // Check for unused workflows
        if (item.lastUsed) {
            const lastDate = new Date(item.lastUsed);
            const diffTime = Math.abs(now - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > UNUSED_DAYS_THRESHOLD) {
                unused.push(item.workflow);
                suggestions.push(`🗑️  Deprecate unused workflow: ${item.workflow} (Last used ${diffDays} days ago)`);
            }
        }

        // Check for high usage
        if (item.count > HIGH_USAGE_THRESHOLD) {
            highUsage.push(item.workflow);
            suggestions.push(`🚀 High usage for ${item.workflow} (${item.count} times). Consider optimizing.`);
        }
    });

    return { unused, highUsage, suggestions };
}

// ==========================================
// Macro-Loop: Pattern Evolution & Deprecation
// ==========================================
function parsePatterns(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const patterns = [];
    let currentPattern = null;

    for (const line of lines) {
        if (line.match(/^### (([A-Z]+-\d+):.*|.*原理.*)/)) {
            if (currentPattern) patterns.push(currentPattern);
            currentPattern = { name: line.replace(/^### /, '').trim(), hits: 0, uses: 0, status: 'active' };
        } else if (currentPattern) {
            const hitMatch = line.match(/\*.*?ヒット率.*?\*\s*:\s*(\d+)\s*\/\s*(\d+)/i) || line.match(/ヒット率:\s*(\d+)\/(\d+)/);
            if (hitMatch) {
                currentPattern.hits = parseInt(hitMatch[1], 10);
                currentPattern.uses = parseInt(hitMatch[2], 10);
            }
            const freqMatch = line.match(/\*.*?発見頻度.*?\*\s*:\s*(\d+)/i) || line.match(/発見頻度:\s*(\d+)/);
            if (freqMatch && currentPattern.uses === 0) {
                // Fallback if explicitly hit/uses is not structured but frequency is
                currentPattern.uses = parseInt(freqMatch[1], 10);
            }
            const statusMatch = line.match(/\*.*?ステータス.*?\*\s*:\s*(.*)/i) || line.match(/ステータス:\s*(.*)/);
            if (statusMatch) {
                currentPattern.status = statusMatch[1].trim().toLowerCase();
            }
        }
    }
    if (currentPattern) patterns.push(currentPattern);
    return patterns;
}

function analyzePatterns(patterns, type) {
    const suggestions = [];
    patterns.forEach(p => {
        if (p.status.includes('deprecated') || p.status.includes('archived')) return;
        if (p.uses > 5) {
            const rate = p.hits / p.uses;
            if (rate < 0.2) {
                suggestions.push(`🧹 [${type}] Low hit rate for rule '${p.name}' (${p.hits}/${p.uses} = ${(rate * 100).toFixed(0)}%). Consider marking as deprecated.`);
            }
        } else if (p.uses === 0 && p.hits === 0 && p.status === 'active') {
            // Can be extended to penalize very old un-used patterns
        }
    });
    return suggestions;
}

function main() {
    const args = process.argv.slice(2);
    const isCheckoutMode = args.includes('--checkout') || args.includes('--silent');

    if (!isCheckoutMode) {
        console.log("🧬 Analyzing Antigravity System Usage and Evolution Patterns...\n");
    }

    const usageData = readTracker();
    if (!usageData) {
        if (!isCheckoutMode) console.error("❌ Could not read USAGE_TRACKER.md");
        process.exit(0);
    }

    const analysis = analyzeUsage(usageData);

    // Analyze Sweep and Test Evolution Patterns (Macro-Loop)
    const projectDir = process.env.PWD || process.cwd();
    const sweepFile = path.join(projectDir, '.sweep_patterns.md');
    const testEvolveFile = path.join(projectDir, '.test_evolution_patterns.md');

    // Also check global knowledge base
    const globalPatternsDir = path.join(ANTIGRAVITY_DIR, 'knowledge', 'debug_patterns');
    const globalTestPatternsDir = path.join(ANTIGRAVITY_DIR, 'knowledge', 'test_evolution_patterns');

    const sweepPatterns = parsePatterns(sweepFile);
    const testPatterns = parsePatterns(testEvolveFile);

    const patternSuggestions = [
        ...analyzePatterns(sweepPatterns, 'Error Sweep'),
        ...analyzePatterns(testPatterns, 'Test Evolve')
    ];

    if (!isCheckoutMode) {
        console.log(`📊 Usage Analysis:`);
        console.log(`   - Total Workflows Tracked: ${usageData.length}`);
        console.log(`   - High Usage Workflows: ${analysis.highUsage.length}`);
        console.log(`   - Potentially Unused Workflows: ${analysis.unused.length}`);
        console.log(`   - Active Sweep/Test Patterns: ${sweepPatterns.length + testPatterns.length}\n`);
    }

    // Merge evolution suggestions
    analysis.suggestions.push(...patternSuggestions);

    if (analysis.suggestions.length > 0) {
        console.log(`💡 Evolution Proposals:`);
        analysis.suggestions.forEach(s => console.log(`   ${s}`));
        if (isCheckoutMode && patternSuggestions.length > 0) {
            console.log(`   (Run '/evolve' or manually archive low-hit patterns)`);
        } else if (isCheckoutMode) {
            console.log(`   (Run '/evolve' for details)`);
        }
    } else {
        if (!isCheckoutMode) {
            console.log(`✨ System and Patterns are healthy. No immediate evolution actions proposed.`);
        }
    }
}

main();
