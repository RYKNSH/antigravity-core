const fs = require('fs');
const path = require('path');

const USAGE_TRACKER_PATH = '/Users/ryotarokonishi/.antigravity/USAGE_TRACKER.md';
const ANTIGRAVITY_DIR = path.dirname(USAGE_TRACKER_PATH);

// Ensure the .antigravity directory exists
if (!fs.existsSync(ANTIGRAVITY_DIR)) {
    console.log(`Directory ${ANTIGRAVITY_DIR} does not exist. Creating...`);
    fs.mkdirSync(ANTIGRAVITY_DIR, { recursive: true });
    console.log(`Created directory: ${ANTIGRAVITY_DIR}`);
}

// Check if USAGE_TRACKER.md exists, if not, create it with a template
if (!fs.existsSync(USAGE_TRACKER_PATH)) {
    console.log(`USAGE_TRACKER.md does not exist at ${USAGE_TRACKER_PATH}. Creating with initial template...`);
    const initialTemplate = `# Antigravity Usage Tracker

## Daily Usage

| Date       | Command Count |
|------------|---------------|
`;
    fs.writeFileSync(USAGE_TRACKER_PATH, initialTemplate);
    console.log(`Created initial USAGE_TRACKER.md.`);
} else {
    console.log(`USAGE_TRACKER.md already exists at ${USAGE_TRACKER_PATH}.`);
}

// --- Placeholder for the original logic of update_usage_tracker.js ---
// The script would continue its normal operation here,
// knowing that USAGE_TRACKER.md is guaranteed to exist.
console.log("USAGE_TRACKER.md is ready. Proceeding with usage tracking logic...");
