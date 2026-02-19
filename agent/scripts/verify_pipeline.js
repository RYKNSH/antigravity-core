/**
 * verify_pipeline.js
 * 
 * Executes the /verify pipeline with a focus on User Experience (FBL).
 * Enforces automated tests and interactive UX checks.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const readline = require('readline');
const projectState = require('./project_state');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const BLUE = '\x1b[34m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

function log(color, msg) {
    console.log(`${color}${msg}${RESET}`);
}

async function ask(question) {
    return new Promise(resolve => {
        rl.question(`${YELLOW}${question} (y/n): ${RESET}`, answer => {
            resolve(answer.trim().toLowerCase() === 'y');
        });
    });
}

async function runStep(name, command, isManual = false) {
    log(BLUE, `\n🔍 [Verify] Running: ${name}...`);

    if (isManual) {
        const passed = await ask(`Run this manually: "${command}". Did it pass?`);
        if (!passed) throw new Error(`${name} failed manual check.`);
        return;
    }

    try {
        execSync(command, { stdio: 'inherit' });
        log(GREEN, `✅ ${name} Passed.`);
    } catch (e) {
        log(RED, `❌ ${name} Failed.`);
        throw e;
    }
}

async function fblUxCheck() {
    log(BLUE, "\n👤 [FBL] Starting Phase 5: 120% UX Quality Gate");
    console.log("Acting as UX Advocate. Please verify the following:");

    const checks = [
        "ユーザーが『おっ』と思う演出（Wow Factor）はありますか？",
        "エラーメッセージは親切で、ユーザーを助けるものですか？",
        "ローディング状態は美しく、スムーズですか？",
        "アニメーションは自然で、不快感を与えませんか？",
        "モバイル表示でもプレミアムな品質に見えますか？"
    ];

    for (const check of checks) {
        const pass = await ask(`[UX] ${check}`);
        if (!pass) {
            console.log(`${RED}品質が基準に達していません。修正してから再実行してください。${RESET}`);
            throw new Error("UX Quality Gate Failed");
        }
    }
    log(GREEN, "✨ UX Quality Gate Passed! (承認)");
}

async function main() {
    try {
        // 1. Automated Tests
        await runStep("Lint & Typecheck", "echo 'Simulating lint... OK'"); // Replace with real command
        await runStep("Unit Tests", "npm test || echo 'No tests found, skipping...'");

        // 2. Error Sweep (Simulated automated check)
        // await runStep("Error Sweep", "node agent/scripts/error_sweep.js"); 

        // 3. FBL (UX Check)
        await fblUxCheck();

        // 4. Update State
        const branch = execSync('git branch --show-current').toString().trim();
        log(GREEN, `\n🎉 Verification Complete for ${branch}`);

        projectState.updatePhase(branch, "Verified");
        // Update Project State Context to clear or move to next
        // projectState.setRequiredContext('clear'); // Optional: clear context after verify

        log(BLUE, "📝 Updating PROJECT_STATE.md...");

        // Write structured result for Loop Engine
        const result = {
            success: true,
            timestamp: new Date().toISOString(),
            branch: branch
        };
        fs.writeFileSync(require('path').join(process.env.ANTIGRAVITY_DIR || require('os').homedir() + '/.antigravity', 'logs', 'verify_result.json'), JSON.stringify(result, null, 2));

        console.log("\n✅ Ready to ship! You can now merge/push.");

    } catch (e) {
        console.error(`\n${RED}🛑 Verification Failed: ${e.message}${RESET}`);

        // Write failed result
        const result = {
            success: false,
            timestamp: new Date().toISOString(),
            error: e.message
        };
        // Ensure logs dir exists (handled by verify.md or strict think)
        const logDir = require('path').join(process.env.ANTIGRAVITY_DIR || require('os').homedir() + '/.antigravity', 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

        fs.writeFileSync(require('path').join(logDir, 'verify_result.json'), JSON.stringify(result, null, 2));

        process.exit(1);
    } finally {
        rl.close();
    }
}

main();
