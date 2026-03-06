const { curlRequest } = require('./lib/curl_client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Env Setup
let envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    // Try global antigravity dir
    const homeDir = require('os').homedir();
    const globalEnvPath = path.join(homeDir, '.antigravity', '.env');
    if (fs.existsSync(globalEnvPath)) {
        envPath = globalEnvPath;
    }
}

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["'](.*)["']$/, '$1');
    });
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 2. Helper: OpenAI API
function openaiRequest(endpoint, body) {
    if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
    const options = {
        hostname: 'api.openai.com',
        path: endpoint,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        }
    };
    return curlRequest(options, body);
}

// 3. Main Logic
async function main() {
    const taskName = process.argv[2];
    const planFile = process.argv[3];

    if (!taskName || !planFile) {
        console.error("Usage: node auto_plan.js <task_name> <plan_file>");
        process.exit(1);
    }

    if (!OPENAI_API_KEY) {
        console.error("Skipping auto-plan: No OPENAI_API_KEY found.");
        process.exit(1); // Exit with error to trigger fallback in shell script
    }

    console.log(`🧠 Thinking about "${taskName}"...`);

    // Gather Context
    let fileStructure = "";
    try {
        // Limit depth and exclude hidden files/dirs usually ignored
        fileStructure = execSync('find . -maxdepth 2 -not -path "*/.*" -not -path "./node_modules*"').toString();
    } catch (e) {
        fileStructure = "Could not retrieve file structure.";
    }

    const systemPrompt = `あなたは熟練したテクニカルアーキテクトです。
あなたの目標は、与えられたタスクに対して、Markdown形式で具体的な実装計画（Implementation Plan）を作成することです。
タスク名と現在のプロジェクトファイル構成が与えられます。

出力フォーマット:
# Implementation Plan: {Task Name}

## Goal Description
このタスクで達成することを簡潔に日本語で記述してください。

## User Review Required
ユーザーの確認が必要な項目（破壊的変更、手動作業など）を1〜3点リストアップしてください。ない場合は「なし」と記述してください。

## Proposed Changes
作成または修正が必要なファイルをリストアップしてください。論理的にグループ化してください。
フォーマット:
### [コンポーネント名]
- [ ] **path/to/file**: 変更内容の説明（日本語）

## Verification Plan
1. Automated Tests: ...
2. Manual Verification: ...
`;

    const userPrompt = `タスク名: "${taskName}"

現在のプロジェクトファイル構成 (参考):
${fileStructure}

高品質な実装計画を日本語でMarkdown形式で作成してください。`;

    const modelName = process.env.LLM_MODEL || "gpt-4o";

    try {
        const completion = await openaiRequest('/v1/chat/completions', {
            model: modelName,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]
        });

        const planContent = completion.choices[0].message.content;

        fs.writeFileSync(planFile, planContent);
        console.log(`✨ Plan written to ${planFile}`);

    } catch (error) {
        console.error("❌ Auto-plan generation failed:", error.message);
        process.exit(1);
    }
}

main();
