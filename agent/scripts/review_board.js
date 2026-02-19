const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Review Board (Updated)
 * 
 * Usage: node review_board.js <file_path> [lint_command]
 */

const targetFile = process.argv[2];
const lintCommand = process.argv[3] || `npx eslint ${targetFile}`; // Default to eslint

if (!targetFile) {
  console.error("Usage: node review_board.js <file_path> [lint_command]");
  process.exit(1);
}

console.log(`🧐 Convening Review Board for: ${targetFile}...`);

// 1. Run Linters (Real Execution)
let lintOutput = "";
let lintError = false;

console.log(`Running Check: ${lintCommand}`);
try {
    lintOutput = execSync(lintCommand, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    console.log("✅ Automated Check Passed.");
} catch (e) {
    lintError = true;
    lintOutput = e.stdout + "\n" + e.stderr;
    console.log("❌ Automated Check Failed.");
}

// 2. Assemble Team
const team = ["QA Engineer", "Security Specialist", "Architect"];
console.log(`Board Members: ${team.join(", ")}`);

// 3. Generate Review Prompt
const prompt = `
You are a Review Board consisting of ${team.join(", ")}.
Review the following code in ${targetFile}.

## Automated Check Results
Command: ${lintCommand}
Result: ${lintError ? "FAILED" : "PASSED"}
Output:
\`\`\`
${lintOutput.trim() || "(No Output)"}
\`\`\`

## Roles
- QA Engineer: Focus on edge cases and testability.
- Security Specialist: Focus on vulnerabilities.
- Architect: Focus on structure and scalability.

## Code
(Content of ${targetFile})

## Output
Provide a consolidated list of critical issues and blocking concerns.
If Automated Checks failed, those are BLOCKING issues.
`;

console.log("----- REVIEW PROMPT GENERATED -----");
console.log(prompt);
console.log("-----------------------------------");
console.log("Instruction: Copy the prompt above and generate the review.");
