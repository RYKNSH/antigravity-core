#!/usr/bin/env node

/**
 * evolve.js - Self-Evolution Logic
 * 
 * Analyzes usage data from USAGE_TRACKER.md and session_state.json
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

function main() {
    const args = process.argv.slice(2);
    const isCheckoutMode = args.includes('--checkout') || args.includes('--silent');

    if (!isCheckoutMode) {
        console.log("🧬 Analyzing Antigravity System Usage...\n");
    }

    const usageData = readTracker();
    if (!usageData) {
        // In checkout mode, we don't want to error out loudly
        if (!isCheckoutMode) console.error("❌ Could not read USAGE_TRACKER.md");
        process.exit(0);
    }

    const analysis = analyzeUsage(usageData);

    if (!isCheckoutMode) {
        console.log(`📊 Usage Analysis:`);
        console.log(`   - Total Workflows Tracked: ${usageData.length}`);
        console.log(`   - High Usage Workflows: ${analysis.highUsage.length}`);
        console.log(`   - Potentially Unused Workflows: ${analysis.unused.length}\n`);
    }

    if (analysis.suggestions.length > 0) {
        console.log(`💡 Evolution Proposals:`);
        analysis.suggestions.forEach(s => console.log(`   ${s}`));
        if (isCheckoutMode) {
            console.log(`   (Run '/evolve' for details)`);
        }
    } else {
        if (!isCheckoutMode) {
            console.log(`✨ System is healthy. No immediate evolution actions proposed.`);
        }
    }
}

main();
