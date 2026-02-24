#!/usr/bin/env node
/**
 * server_evolve.js — サーバーサイド自律改善エンジン
 *
 * 動作:
 * 1. incidents.md の OPEN インシデントを収集
 * 2. brain_log/ の INCIDENT エントリ（INCIDENT_FORMAT.md形式）を収集
 * 3. パターン分析（コンポーネント別頻度・WF別影響）
 * 4. 改善提案を生成（WFのルール追記 / スクリプト修正方針）
 * 5. GitHub API 経由でPRを自動作成（bot: evolve-proposal ラベル付き）
 *
 * 使用方法:
 *   GITHUB_TOKEN=xxx node agent/scripts/server_evolve.js
 *   node agent/scripts/server_evolve.js --dry-run  # PR作成なしで提案のみ表示
 *
 * GitHub Actions から呼び出される場合:
 *   env.GITHUB_TOKEN は Actions の secrets.GITHUB_TOKEN を使用
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(os.homedir(), '.antigravity');
const DRY_RUN = process.argv.includes('--dry-run');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER || 'RYKNSH';
const REPO_NAME = (process.env.GITHUB_REPOSITORY || 'RYKNSH/antigravity-core').split('/')[1];

// ══════════════════════════════════════════
// 1. incidents.md から OPEN インシデントを収集
// ══════════════════════════════════════════
function collectOpenIncidents() {
    const incidentsPath = path.join(ANTIGRAVITY_DIR, 'incidents.md');
    if (!fs.existsSync(incidentsPath)) return [];

    const content = fs.readFileSync(incidentsPath, 'utf8');
    const incidents = [];
    const regex = /## (INC-\d+) \[OPEN\] (.+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        incidents.push({ id: match[1], title: match[2] });
    }
    return incidents;
}

// ══════════════════════════════════════════
// 2. brain_log/ から INCIDENT エントリを収集（INCIDENT_FORMAT.md形式）
// ══════════════════════════════════════════
function collectBrainLogIncidents() {
    const brainLogDir = path.join(ANTIGRAVITY_DIR, 'brain_log');
    if (!fs.existsSync(brainLogDir)) return [];

    const incidents = [];
    const files = fs.readdirSync(brainLogDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
        const content = fs.readFileSync(path.join(brainLogDir, file), 'utf8');
        // INCIDENT_FORMAT.md形式のエントリを解析
        const entryRegex = /## \[(INCIDENT|FIXED)\] session_(\d+)\n([\s\S]+?)(?=\n## \[|$)/g;
        let match;
        while ((match = entryRegex.exec(content)) !== null) {
            const type = match[1];
            const session = match[2];
            const body = match[3];

            const extract = (key) => {
                const m = body.match(new RegExp(`- ${key}: (.+)`));
                return m ? m[1].trim() : '';
            };

            incidents.push({
                session,
                type,
                component: extract('component'),
                trigger: extract('trigger'),
                layer: extract('layer'),
                status: extract('status'),
                relatedWf: extract('related_wf'),
                sourceFile: file,
            });
        }
    }
    return incidents;
}

// ══════════════════════════════════════════
// 3. パターン分析
// ══════════════════════════════════════════
function analyzePatterns(brainLogIncidents) {
    const componentFreq = {};
    const wfFreq = {};
    const layerFreq = {};

    for (const inc of brainLogIncidents) {
        if (inc.status !== 'OPEN') continue;

        componentFreq[inc.component] = (componentFreq[inc.component] || 0) + 1;

        for (const wf of (inc.relatedWf || '').split(',').map(s => s.trim()).filter(Boolean)) {
            wfFreq[wf] = (wfFreq[wf] || 0) + 1;
        }

        if (inc.layer) {
            layerFreq[inc.layer] = (layerFreq[inc.layer] || 0) + 1;
        }
    }

    return { componentFreq, wfFreq, layerFreq };
}

// ══════════════════════════════════════════
// 4. 改善提案を生成
// ══════════════════════════════════════════
function generateProposals(openIncidents, patterns) {
    const proposals = [];
    const { componentFreq, wfFreq } = patterns;

    // 頻度の高いコンポーネントへの対策
    for (const [component, count] of Object.entries(componentFreq).sort((a, b) => b[1] - a[1])) {
        if (count >= 2) {
            proposals.push({
                title: `fix: ${component} で ${count}回のハングが発生 — タイムアウト設定を強化`,
                body: `## 提案背景\n\nbrain_log の分析で \`${component}\` が ${count}回ハングしています。\n\n## 改善案\n\n- \`safe-commands.md\` に \`${component}\` 固有のタイムアウトルールを追加\n- \`dependency_map.json\` の \`hang_risk\` を \`HIGH\` に更新\n- \`checkout.md\` / \`checkin.md\` の該当ステップに \`timeout\` ラッパーを追加\n\n## 影響範囲\n\n- コンポーネント: \`${component}\`\n- 影響WF: ${Object.entries(wfFreq).map(([k]) => k).join(', ')}\n\n> このPRは \`server_evolve.js\` によって自動生成されました。`,
                labels: ['bot: evolve-proposal', 'priority: medium'],
            });
        }
    }

    // incidents.md の OPEN インシデントへの対策
    for (const inc of openIncidents) {
        proposals.push({
            title: `fix: ${inc.id} ${inc.title} の再発防止策を実装`,
            body: `## 背景\n\n\`incidents.md\` に登録された未解決インシデント \`${inc.id}\` の再発防止策が必要です。\n\n## 提案\n\n- 根本原因を特定し \`safe-commands.md\` にルールを追加\n- \`dependency_map.json\` の \`hang_correlation\` に相関情報を追記\n- 必要に応じて該当スクリプトを修正\n\n> このPRは \`server_evolve.js\` によって自動生成されました。`,
            labels: ['bot: evolve-proposal', 'priority: high'],
        });
    }

    return proposals;
}

// ══════════════════════════════════════════
// 5. GitHub API — Issue 作成（PR代替: 現時点では改善提案をIssueで管理）
// ══════════════════════════════════════════
function githubRequest(method, endpoint, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: endpoint,
            method,
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'antigravity-server-evolve/1.0',
                'Content-Type': 'application/json',
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, body: data }); }
            });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(new Error('GitHub API timeout')); });

        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function createIssue(proposal) {
    const res = await githubRequest('POST', `/repos/${REPO_OWNER}/${REPO_NAME}/issues`, {
        title: proposal.title,
        body: proposal.body,
        labels: proposal.labels,
    });

    if (res.status === 201) {
        console.log(`  ✅ Issue作成: #${res.body.number} — ${proposal.title}`);
        return res.body;
    } else {
        console.error(`  ❌ Issue作成失敗 (${res.status}):`, JSON.stringify(res.body).slice(0, 200));
        return null;
    }
}

// ══════════════════════════════════════════
// メイン
// ══════════════════════════════════════════
async function main() {
    console.log('\n🤖 server_evolve.js — 自律改善エンジン起動');
    console.log(`   モード: ${DRY_RUN ? 'DRY RUN（Issue作成なし）' : 'LIVE'}`);
    console.log(`   リポジトリ: ${REPO_OWNER}/${REPO_NAME}\n`);

    // 1. データ収集
    const openIncidents = collectOpenIncidents();
    console.log(`📋 incidents.md OPEN: ${openIncidents.length}件`);
    openIncidents.forEach(i => console.log(`   - ${i.id}: ${i.title}`));

    const brainLogIncidents = collectBrainLogIncidents();
    const openBrainLog = brainLogIncidents.filter(i => i.status === 'OPEN');
    console.log(`\n📋 brain_log INCIDENT (OPEN): ${openBrainLog.length}件`);
    openBrainLog.forEach(i => console.log(`   - [${i.session}] ${i.component}: ${i.trigger}`));

    // 2. パターン分析
    const patterns = analyzePatterns(brainLogIncidents);
    console.log('\n📊 コンポーネント別ハング頻度:');
    Object.entries(patterns.componentFreq)
        .sort((a, b) => b[1] - a[1])
        .forEach(([k, v]) => console.log(`   ${k}: ${v}回`));

    // 3. 改善提案生成
    const proposals = generateProposals(openIncidents, patterns);
    console.log(`\n💡 改善提案: ${proposals.length}件`);
    proposals.forEach((p, i) => console.log(`   ${i + 1}. ${p.title}`));

    if (proposals.length === 0) {
        console.log('\n✅ 改善提案なし — インシデントはすべて解決済みです');
        return;
    }

    if (DRY_RUN) {
        console.log('\n[DRY RUN] Issue作成をスキップしました');
        return;
    }

    if (!GITHUB_TOKEN) {
        console.warn('\n⚠️  GITHUB_TOKEN が未設定です。Issue作成をスキップします。');
        console.warn('   実行方法: GITHUB_TOKEN=xxx node server_evolve.js');
        return;
    }

    // 4. Issue作成（改善提案ごと）
    console.log('\n🚀 GitHub Issues を作成中...');
    for (const proposal of proposals) {
        await createIssue(proposal);
        // レートリミット対策
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n✅ server_evolve.js 完了');
}

main().catch(err => {
    console.error('❌ 予期しないエラー:', err.message);
    process.exit(1);
});
