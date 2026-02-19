#!/usr/bin/env node

/**
 * setup.js
 * 
 * Initializes a new Antigravity project environment.
 * - Creates PROJECT_STATE.md
 * - Inits Git (if needed)
 * - Configures Worktree support directory structure
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const projectState = require('./project_state');

const PROJECT_ROOT = process.cwd();

console.log("🚀 Initializing Antigravity Project Environment...\n");

// 1. Git Init
if (!fs.existsSync(path.join(PROJECT_ROOT, '.git'))) {
    console.log("📦 Initializing Git repository...");
    try {
        execSync('git init', { stdio: 'inherit' });
    } catch (e) {
        console.error("❌ Failed to init git:", e.message);
    }
} else {
    console.log("✅ Git repository already initialized.");
}

// 2. PROJECT_STATE.md
console.log("📄 Setting up PROJECT_STATE.md...");
projectState.init();

// 3. Worktree Directory Structure
// We recommend creating a 'worktrees' directory outside or ignored?
// Usually worktrees are sibling directories.
// Here we just ensure .gitignore ignores 'worktrees/' if user decides to put it inside.

const gitignorePath = path.join(PROJECT_ROOT, '.gitignore');
const worktreeEntry = 'worktrees/';

if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    if (!content.includes(worktreeEntry)) {
        fs.appendFileSync(gitignorePath, `\n${worktreeEntry}\n`);
        console.log("🙈 Added 'worktrees/' to .gitignore");
    }
} else {
    fs.writeFileSync(gitignorePath, `${worktreeEntry}\n`);
    console.log("🙈 Created .gitignore with 'worktrees/'");
}

console.log("\n✨ Setup Complete! usage:");
console.log("  1. /think \"First Task\"  -> Create plan & branch");
console.log("  2. /go \"Task\"           -> Implement");
console.log("  3. /verify              -> Verify & Ship");
