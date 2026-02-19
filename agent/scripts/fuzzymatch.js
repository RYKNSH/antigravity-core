/**
 * fuzzymatch.js
 * 
 * Helper script to fuzzy match a keyword against active branches and project state tasks.
 * Used by /go and /verify to find the correct worktree/branch.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const projectState = require('./project_state');

const QUERY = process.argv[2];

if (!QUERY) {
    console.error("Usage: node fuzzymatch.js <query>");
    process.exit(1);
}

// 1. Get List from PROJECT_STATE.md
const state = projectState.parse();
if (!state) {
    console.error("❌ PROJECT_STATE.md not found. Run /setup first.");
    process.exit(1);
}

// 2. Simple Fuzzy Logic
// We look for keyword in Task Name OR Branch Name
const matches = state.active.filter(item => {
    const q = QUERY.toLowerCase();
    return item.task.toLowerCase().includes(q) || item.branch.toLowerCase().includes(q);
});

// 3. Output Result
if (matches.length === 1) {
    // Exact single match found
    const m = matches[0];
    console.log(JSON.stringify({
        found: true,
        type: 'single',
        branch: m.branch,
        task: m.task,
        worktree_path: path.resolve(process.cwd(), `../worktrees/${m.branch.replace('feat/', '').replace('fix/', '')}`)
    }));
} else if (matches.length > 1) {
    // Multiple matches
    console.log(JSON.stringify({
        found: true,
        type: 'multiple',
        matches: matches.map(m => ({ branch: m.branch, task: m.task }))
    }));
} else {
    // No match
    // Check backlog for suggestion?
    const backlogMatches = state.backlog.filter(l => l.toLowerCase().includes(QUERY.toLowerCase()));

    console.log(JSON.stringify({
        found: false,
        backlog_suggestions: backlogMatches
    }));
}
