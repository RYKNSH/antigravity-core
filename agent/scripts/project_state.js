/**
 * project_state.js
 * 
 * Manages the PROJECT_STATE.md file, which serves as the single source of truth
 * for the project's active tasks and backlog.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();
const STATE_FILE = path.join(PROJECT_ROOT, 'PROJECT_STATE.md');

// Template for new PROJECT_STATE.md
const TEMPLATE = `# Project State

## 🚀 Active Streams (Branches)
<!-- format: - [Status] Task Name (branch-name) - @Phase -->
- [ ] Example Task (feat/example) - @Think

## 🧠 Required Context
<!-- format: - [Context Path] (Reason) -->
- None

## 📋 Backlog
<!-- format: - [ ] Task Name -->
- [ ] Initial Setup

## 📦 Archive
<!-- format: - [x] Task Name (branch-name) -->
`;

/**
 * Ensures PROJECT_STATE.md exists.
 */
function init() {
    if (!fs.existsSync(STATE_FILE)) {
        fs.writeFileSync(STATE_FILE, TEMPLATE, 'utf8');
        console.log(`✅ Created PROJECT_STATE.md at ${STATE_FILE}`);
    } else {
        console.log(`ℹ️  PROJECT_STATE.md already exists.`);
    }
}

/**
 * Parses PROJECT_STATE.md into a structured object.
 */
function parse() {
    if (!fs.existsSync(STATE_FILE)) return null;
    const content = fs.readFileSync(STATE_FILE, 'utf8');
    const lines = content.split('\n');

    const state = {
        active: [],
        backlog: [],
        archive: [],
        requiredContext: []
    };

    let currentSection = null;

    for (const line of lines) {
        if (line.includes('## 🚀 Active Streams')) {
            currentSection = 'active';
        } else if (line.includes('## 📋 Backlog')) {
            currentSection = 'backlog';
        } else if (line.includes('## 📦 Archive')) {
            currentSection = 'archive';
        } else if (line.includes('## 🧠 Required Context')) {
            currentSection = 'context';
        } else if (line.trim().startsWith('- [')) {
            if (currentSection === 'active') {
                // Parse: - [ ] Task Name (branch) - @Phase
                const match = line.match(/- \[(.)\] (.*?) \((.*?)\) - @(.*)/);
                if (match) {
                    state.active.push({
                        status: match[1],
                        task: match[2],
                        branch: match[3],
                        phase: match[4],
                        raw: line
                    });
                }
            } else if (currentSection === 'backlog') {
                state.backlog.push(line);
            } else if (currentSection === 'archive') {
                state.archive.push(line);
            } else if (currentSection === 'context') {
                state.requiredContext.push(line);
            }
        }
    }
    return state;
}

/**
 * Adds a new task to Active Streams.
 */
function addActiveTask(taskName, branch, phase = 'Think') {
    if (!fs.existsSync(STATE_FILE)) init();

    const content = fs.readFileSync(STATE_FILE, 'utf8');
    const lines = content.split('\n');
    const newLines = [];
    let added = false;

    for (const line of lines) {
        newLines.push(line);
        if (line.includes('## 🚀 Active Streams') && !added) {
            // Check if next line is a comment or empty, verify we are not breaking structure
            // Simply append after the header (or check for comments)
            // Ideally locate the end of the section, but prepending to top of list is easier
            // Let's create the line
            const newLine = `- [ ] ${taskName} (${branch}) - @${phase}`;
            newLines.push(newLine);
            added = true;
        }
    }

    fs.writeFileSync(STATE_FILE, newLines.join('\n'), 'utf8');
    console.log(`✅ Added active task: ${taskName} (${branch})`);
}

/**
 * Updates the phase of an active task.
 */
function updatePhase(branch, newPhase) {
    if (!fs.existsSync(STATE_FILE)) return;

    const content = fs.readFileSync(STATE_FILE, 'utf8');
    const lines = content.split('\n');
    const newLines = lines.map(line => {
        if (line.includes(`(${branch})`)) {
            // Regex to replace phase
            return line.replace(/- @.*/, `- @${newPhase}`);
        }
        return line;
    });

    fs.writeFileSync(STATE_FILE, newLines.join('\n'), 'utf8');
    console.log(`✅ Updated phase for ${branch} to @${newPhase}`);
}

/**
 * Moves a task to Archive.
 */
function completeTask(branch) {
    if (!fs.existsSync(STATE_FILE)) return;

    const content = fs.readFileSync(STATE_FILE, 'utf8');
    const lines = content.split('\n');
    const newLines = [];
    let taskLine = null;

    // 1. Remove from Active
    for (const line of lines) {
        if (line.includes(`(${branch})`)) {
            taskLine = line.replace('- [ ]', '- [x]'); // Mark done
        } else {
            newLines.push(line);
        }
    }

    if (!taskLine) return; // Not found

    // 2. Add to Archive
    const finalLines = [];
    let added = false;
    for (const line of newLines) {
        finalLines.push(line);
        if (line.includes('## 📦 Archive') && !added) {
            finalLines.push(taskLine);
            added = true;
        }
    }

    fs.writeFileSync(STATE_FILE, finalLines.join('\n'), 'utf8');
    console.log(`✅ Archived task: ${branch}`);
    console.log(`✅ Archived task: ${branch}`);
}

/**
 * Updates the Required Context section.
 */
function setRequiredContext(contextPath, reason = 'Protocol Requirement') {
    if (!fs.existsSync(STATE_FILE)) return;

    const content = fs.readFileSync(STATE_FILE, 'utf8');
    const lines = content.split('\n');
    const newLines = [];
    let inContextSection = false;
    let contextUpdated = false;

    // We want to replace the entire content of the section with the new single context
    // or clear it if contextPath is 'clear'

    for (const line of lines) {
        if (line.includes('## 🧠 Required Context')) {
            newLines.push(line);
            newLines.push('<!-- format: - [Context Path] (Reason) -->');
            if (contextPath !== 'clear') {
                newLines.push(`- [${contextPath}] (${reason})`);
            } else {
                newLines.push(`- None`);
            }
            inContextSection = true;
            contextUpdated = true;
        } else if (inContextSection) {
            // Skip existing lines in context section until next section
            if (line.startsWith('## ')) {
                inContextSection = false;
                newLines.push(line);
            }
        } else {
            newLines.push(line);
        }
    }

    if (!contextUpdated) {
        // If section didn't exist, append it (for old files)
        newLines.push('');
        newLines.push('## 🧠 Required Context');
        newLines.push('<!-- format: - [Context Path] (Reason) -->');
        if (contextPath !== 'clear') {
            newLines.push(`- [${contextPath}] (${reason})`);
        } else {
            newLines.push(`- None`);
        }
    }

    fs.writeFileSync(STATE_FILE, newLines.join('\n'), 'utf8');
    console.log(`✅ Set required context: ${contextPath}`);
}

// CLI Interface
const args = process.argv.slice(2);
const command = args[0];

if (command === 'init') {
    init();
} else if (command === 'add') {
    addActiveTask(args[1], args[2], args[3]);
} else if (command === 'phase') {
    updatePhase(args[1], args[2]);
} else if (command === 'done') {
    completeTask(args[1]);
} else if (command === 'context') {
    setRequiredContext(args[1], args[2]);
} else if (command === 'list') {
    const state = parse();
    if (state) {
        console.log(JSON.stringify(state, null, 2));
    }
}

module.exports = { init, parse, addActiveTask, updatePhase, completeTask, setRequiredContext };
