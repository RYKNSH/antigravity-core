#!/usr/bin/env node
/**
 * server_evolve.js — サーバーサイド自律改善エンジン v2.0
 *
 * v2.0 変更点（MR適用）:
 *   - MR-01: ハードコードされた閾値（count >= 2）を除去。文脈・目的で評価
 *   - MR-02: 各提案にメタルール評価セクションを追加
 *   - MR-07: Issue本文に価値階層を埋め込み、人間（理念の番人）が評価しやすい形に
 *   - MR-08: 早く提案・早くリカバリー設計。「防止」より「早期発見」
 *
 * 動作:
 * 1. incidents.md の OPEN インシデントを収集
 * 2. brain_log/ の INCIDENT エントリを収集
 * 3. パターン分析（コンポーネント別・WF別）
 * 4. DECISION_USECASES.md + 価値階層を評価コンテキストとして読み込み
 * 5. 改善提案を GitHub Issue として作成（人間が理念の番人として評価）
 *
 * 使用方法:
 *   GITHUB_TOKEN=xxx node agent/scripts/server_evolve.js
 *   node agent/scripts/server_evolve.js --dry-run
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
// 価値階層（人間の判断基準の核心 / MR-07: 人間は理念の番人）
// ══════════════════════════════════════════
const VALUE_HIERARCHY = `
## 判断軸（価値階層）
- 理念: Gift & Receive — 与えることそのものが喜びの文化を創る
- ビジョン: World Peace — 平和な世界
- ミッション: Power to the People — 人々に力を与えろ  ← AIが自律判断できる最上位の基準
- 戦略: UNLOCK PEOPLE VALUE — 人々の価値をアンロックする
- 戦術: SPICE UP WORLD — この地球をもっと面白く

## 自動却下条件
- 付け焼き刃・その場しのぎ
- 怠慢からくる支出
- 難易度や時間を理由にした妥協

## メタルール（判断の原則）
- MR-01: ハードコード・定数的指標を判断軸にしない。文脈・目的・整合性で判断
- MR-03: 迷ったら構造を理解するまで掘る。迷い = 情報不足
- MR-05: ミッションは変えず器を変える判断がある
- MR-07: AIは99%の判断を担う。人間の仕事は理念・ビジョン・ミッションの番人のみ
- MR-08: 間違えることより前に進む。早く間違えて早くリカバリー
`;

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
// 2. brain_log/ から INCIDENT エントリを収集
// ══════════════════════════════════════════
function collectBrainLogIncidents() {
    const brainLogDir = path.join(ANTIGRAVITY_DIR, 'brain_log');
    if (!fs.existsSync(brainLogDir)) return [];

    const incidents = [];
    const files = fs.readdirSync(brainLogDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
        let content;
        try {
            content = fs.readFileSync(path.join(brainLogDir, file), 'utf8');
        } catch (e) {
            console.warn(`⚠️  brain_log/${file} の読み取りをスキップ: ${e.message}`);
            continue;
        }

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
    const triggerMap = {};

    for (const inc of brainLogIncidents) {
        if (inc.status !== 'OPEN') continue;

        componentFreq[inc.component] = (componentFreq[inc.component] || 0) + 1;

        // トリガーを記録（MR-03: 根本原因の構造を理解するため）
        if (!triggerMap[inc.component]) triggerMap[inc.component] = [];
        if (inc.trigger) triggerMap[inc.component].push(inc.trigger);

        for (const wf of (inc.relatedWf || '').split(',').map(s => s.trim()).filter(Boolean)) {
            wfFreq[wf] = (wfFreq[wf] || 0) + 1;
        }

        if (inc.layer) {
            layerFreq[inc.layer] = (layerFreq[inc.layer] || 0) + 1;
        }
    }

    return { componentFreq, wfFreq, layerFreq, triggerMap };
}

// ══════════════════════════════════════════
// 4. 改善提案を生成（MR-01: ハードコード閾値なし）
// ══════════════════════════════════════════
function generateProposals(openIncidents, patterns) {
    const proposals = [];
    const { componentFreq, wfFreq, triggerMap } = patterns;

    // コンポーネント別提案（MR-01: count >= 2 の閾値を撤廃、1件でも提案）
    for (const [component, count] of Object.entries(componentFreq).sort((a, b) => b[1] - a[1])) {
        const triggers = (triggerMap[component] || []).join(' / ') || '不明';
        const affectedWfs = Object.entries(wfFreq).map(([k]) => k).join(', ') || 'なし';

        // MR-03: 根本原因（trigger）を提案に含め、構造理解を促す
        // MR-07: Issue本文に価値階層を埋め込み、人間が理念の番人として評価できる形に
        // MR-08: 提案は防止より早期発見・リカバリー設計
        proposals.push({
            title: `fix: [${component}] ハング発生 (${count}件) — 根本原因の特定と改善`,
            body: `## 📊 インシデント概要

- **コンポーネント**: \`${component}\`
- **発生件数**: ${count}件（すべてOPEN）
- **根本トリガー**: ${triggers}
- **影響WF**: ${affectedWfs}

## 🔍 メタルール評価（人間による確認ポイント）

> **MR-07**: この提案はAIが分析・生成しました。人間（あなた）が理念の番人として以下を確認してください。

| 評価軸 | 確認事項 |
|--------|---------|
| レイヤー | この修正は戦術〜戦略レベル（ミッション以下）の変更か？ |
| 本質性 | 付け焼き刃ではなく根本原因への対処か？（MR-03: 構造を理解した上での修正か） |
| スケール | 修正後はスケール可能な仕組みになるか？（MR-05: 器の選択） |
| 理念整合 | Gift & Receive / World Peace / Power to the People に反しないか？ |

## 💡 推奨アクション

- \`safe-commands.md\` に \`${component}\` 固有のタイムアウトルールを追加
- \`dependency_map.json\` の \`hang_risk\` を更新
- 再発防止ルールを該当WFに追加

## ⚡ MR-08: リカバリー優先

> 完璧な修正を待つより、早く適用して早くリカバリーする。
> この提案が間違っていても、次のサイクルで修正できる。

${VALUE_HIERARCHY}

---
> 🤖 この Issue は \`server_evolve.js v2.0\` によって自動生成されました。`,
            labels: ['bot: evolve-proposal'],
        });
    }

    // incidents.md の OPEN インシデントへの提案
    for (const inc of openIncidents) {
        proposals.push({
            title: `fix: ${inc.id} の再発防止策`,
            body: `## 📋 インシデント情報

- **ID**: \`${inc.id}\`
- **タイトル**: ${inc.title}
- **ステータス**: OPEN（未解決）

## 🔍 メタルール評価（人間による確認ポイント）

> **MR-07**: AIが検出しました。人間（あなた）が以下を確認してください。

| 評価軸 | 確認事項 |
|--------|---------|
| レイヤー | ミッション以下の問題か（AI自律OK）/ 理念・ビジョンに触れるか（人間判断必須） |
| 本質性 | 根本原因への対処か。付け焼き刃でないか |
| リカバリー | MR-08: 早く修正を入れて早く前に進む方向か |

${VALUE_HIERARCHY}

---
> 🤖 この Issue は \`server_evolve.js v2.0\` によって自動生成されました。`,
            labels: ['bot: evolve-proposal'],
        });
    }

    return proposals;
}

// ══════════════════════════════════════════
// 5. GitHub API
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
                'User-Agent': 'antigravity-server-evolve/2.0',
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

async function issueExists(title) {
    if (!GITHUB_TOKEN) return false;
    const res = await githubRequest(
        'GET',
        `/repos/${REPO_OWNER}/${REPO_NAME}/issues?labels=bot%3A+evolve-proposal&state=open&per_page=100`
    );
    if (res.status !== 200 || !Array.isArray(res.body)) return false;
    return res.body.some(issue => issue.title === title);
}

async function createIssue(proposal) {
    if (await issueExists(proposal.title)) {
        console.log(`  ⏭️  スキップ: 重複Issue — ${proposal.title}`);
        return null;
    }

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
    console.log('\n🤖 server_evolve.js v2.0 — 自律改善エンジン起動');
    console.log('   MR適用: MR-01(脱ハードコード) MR-07(理念番人) MR-08(早期発見・リカバリー)');
    console.log(`   モード: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`   リポジトリ: ${REPO_OWNER}/${REPO_NAME}\n`);

    const openIncidents = collectOpenIncidents();
    console.log(`📋 incidents.md OPEN: ${openIncidents.length}件`);
    openIncidents.forEach(i => console.log(`   - ${i.id}: ${i.title}`));

    const brainLogIncidents = collectBrainLogIncidents();
    const openBrainLog = brainLogIncidents.filter(i => i.status === 'OPEN');
    console.log(`\n📋 brain_log INCIDENT (OPEN): ${openBrainLog.length}件`);
    openBrainLog.forEach(i => console.log(`   - [${i.session}] ${i.component}: ${i.trigger}`));

    const patterns = analyzePatterns(brainLogIncidents);
    console.log('\n📊 コンポーネント別ハング頻度:');
    Object.entries(patterns.componentFreq)
        .sort((a, b) => b[1] - a[1])
        .forEach(([k, v]) => console.log(`   ${k}: ${v}件（トリガー: ${(patterns.triggerMap[k] || []).join(' / ')}）`));

    const proposals = generateProposals(openIncidents, patterns);
    console.log(`\n💡 改善提案: ${proposals.length}件`);
    proposals.forEach((p, i) => console.log(`   ${i + 1}. ${p.title}`));

    if (proposals.length === 0) {
        console.log('\n✅ 改善提案なし — インシデントはすべて解決済み');
        return;
    }

    if (DRY_RUN) {
        console.log('\n[DRY RUN] Issue作成をスキップ');
        return;
    }

    if (!GITHUB_TOKEN) {
        console.warn('\n⚠️  GITHUB_TOKEN が未設定です');
        return;
    }

    console.log('\n🚀 GitHub Issues を作成中...');
    for (const proposal of proposals) {
        await createIssue(proposal);
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n✅ server_evolve.js v2.0 完了');
}

main().catch(err => {
    console.error('❌ 予期しないエラー:', err.message);
    process.exit(1);
});
