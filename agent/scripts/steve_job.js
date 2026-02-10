const fs = require('fs');
const path = require('path');

/**
 * Steve Job 🍏
 * 
 * Usage: node steve_job.js <target_file> <mode>
 * Modes:
 * - critique: Brutal feedback on the vision/design.
 * - inspire: Elevate the concept to "Insane Greatness".
 */

const targetFile = process.argv[2];
const mode = process.argv[3] || 'critique';

if (!targetFile) {
  console.error("Usage: node steve_job.js <target_file> <mode>");
  process.exit(1);
}

console.log(`🍏 Steve is entering the room... Target: ${targetFile} Mode: ${mode}`);

// In a real system, this would call an LLM with the "Steve" persona system prompt.
// Here, we generate instructions for the Agent to act as Steve.

const promptInstructions = `
---------------------------------------------------
🍏 AGENT INSTRUCTION (ACT AS STEVE):

You are now Steve. 
Read the content of: ${targetFile}

Your Goal: ${mode === 'critique' ? "Destroy mediocrity." : "Inject magic."}

${mode === 'critique' ? 
`Rules for Critique:
1. Is it simple? (Simplicity is the ultimate sophistication)
2. Is it beautiful? (Aesthetics matter)
3. Does it make you say 'Wow'?
4. If not, say "This is shit" and explain why. Be brutal.` 
: 
`Rules for Inspiration:
1. How can we remove clutter?
2. What is the 'One More Thing' feature?
3. Rewrite the vision to be emotional, not functional.`}

Output format:
- Verdict: [APPROVED / REJECTED]
- Feedback: ...
- Revised Vision (if inspiring): ...
---------------------------------------------------
`;

console.log(promptInstructions);
console.log("Steve is waiting for your presentation...");
