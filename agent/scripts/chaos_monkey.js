const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Chaos Monkey 🐵
 * 
 * Usage: node chaos_monkey.js <target_url_or_file> [attack_mode]
 * 
 * Modes:
 * - fuzz: Send random garbage data
 * - load: Send high volume of requests
 * - null: Send null/undefined/empty values
 */

const target = process.argv[2];
const mode = process.argv[3] || 'fuzz';

if (!target) {
  console.error("Usage: node chaos_monkey.js <target> [mode]");
  process.exit(1);
}

console.log(`🐵 Chaos Monkey attacking ${target} with mode: ${mode}...`);

// Mock attack logic - In a real scenario this would use a fuzzing library or http client
// For the purpose of the agent workflow, this script acts as a guide/trigger for the agent.

const attacks = {
    fuzz: [
        '{"id": "DROP TABLE users"}',
        '{"id": 99999999999999999999999}',
        '{"id": "<script>alert(1)</script>"}',
        'Invalid JSON',
        '😊😊😊😊😊😊😊'
    ],
    null: [
        'null',
        'undefined',
        '""',
        '{}',
        '[]'
    ]
};

console.log(`
---------------------------------------------------
💥 CHAOS REPORT
---------------------------------------------------
Target: ${target}
Attack Vectors Tried:
`);

const vectors = attacks[mode] || attacks.fuzz;
vectors.forEach(vector => {
    console.log(`- Input: ${vector}`);
    // Simulate check (Agent should do this for real)
    console.log(`  -> Status: PENDING AGENT VERIFICATION`); 
});

console.log(`
---------------------------------------------------
🤖 AGENT INSTRUCTION:
1. Provide these inputs to the target (via curl or script).
2. Observe the output (Crash? Error 500? Handled 400?).
3. If it crashes or behaves unexpectedly, Log it as an Anti-Pattern.
---------------------------------------------------
`);
