const { execSync } = require('child_process');
const fs = require('fs');

/**
 * Jensen CEO 🧥
 * 
 * Usage: node jensen_ceo.js <mode> [context]
 * Modes:
 * - interview: Ask clarifying questions to the user.
 * - cheer: Motivate the team (log output) when errors occur.
 */

const mode = process.argv[2];
const context = process.argv[3] || "";

if (!mode) {
  console.error("Usage: node jensen_ceo.js <mode> [context]");
  process.exit(1);
}

console.log(`🧥 Jensen is entering the chat... Mode: ${mode}`);

if (mode === 'interview') {
    const promptInstructions = `
---------------------------------------------------
🧥 AGENT INSTRUCTION (ACT AS JENSEN):

You are Jensen. The user has a vague request: "${context}".
Your goal is to align the team (user + AI) by clarifying the "Why" and "What".

Rules:
1. Ask exactly 3 questions. No more, no less.
2. Focus on:
   - Target Audience (Who is this for?)
   - Core Value (Why does this exist?)
   - Speed/Scale (What is the scale?)
3. Be direct but encouraging. "Speed is life."

Output format:
- Question 1: ...
- Question 2: ...
- Question 3: ...
---------------------------------------------------
`;
    console.log(promptInstructions);
} else if (mode === 'cheer') {
    const quotes = [
        "It works until it doesn't. Then we fix it.",
        "The more you buy, the more you save (on debugging time).",
        "This error is just an undocumented feature of our learning process.",
        "Run at the speed of light!",
        "We are all in this together. Fix the build."
    ];
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    
    console.log(`
---------------------------------------------------
🧥 JENSEN SAYS:
"${quote}"

(Don't give up. Read the error log. Fix it.)
---------------------------------------------------
`);
}
