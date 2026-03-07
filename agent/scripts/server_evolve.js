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
const { execSync } = require('child_process');

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
- MR-09: 記録だけでは学習ループは閉じない。次のセッションへの能動的引き渡しが必要
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
// 2b. NEXT_SESSION.md から警告を収集（MR-09）
// ══════════════════════════════════════════
function collectNextSessionWarnings() {
    const warnings = [];
    const candidates = [
        path.join(ANTIGRAVITY_DIR, 'NEXT_SESSION.md'),
        path.join(os.homedir(), 'Desktop', 'AntigravityWork', 'NEXT_SESSION.md'),
    ];

    for (const filePath of candidates) {
        if (!fs.existsSync(filePath)) continue;
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            // 警告・注意点を抽出
            const warningLines = content.split('\n').filter(line =>
                /⚠️|警告|注意|ゾンビ|ハング|ブロック|I\/Oブロック|残って/.test(line)
            );
            if (warningLines.length > 0) {
                warnings.push({ source: filePath, lines: warningLines });
            }
        } catch (e) {
            // スキップ
        }
    }
    return warnings;
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
function generateProposals(openIncidents, patterns, nextSessionWarnings) {
    const proposals = [];
    const { componentFreq, wfFreq, triggerMap } = patterns;

    // NEXT_SESSION.md の警告から Issue を生成（MR-09）
    for (const warningGroup of nextSessionWarnings) {
        const warningText = warningGroup.lines.join('\n');
        proposals.push({
            title: `alert: NEXT_SESSION.md からの未解決警告を検出`,
            body: `## 📋 NEXT_SESSION.md 警告（MR-09: 能動的引き渡し）

> 前セッションが記録した警告が未処理のまま次のセッションに持ち越されています。

**ソース**: \`${warningGroup.source}\`

**警告内容**:
\`\`\`
${warningText}
\`\`\`

## 🔍 確認事項

- [ ] 警告に記載のゾンビプロセスが残存していないか確認
- [ ] 根本原因を特定してincidents.mdに記録
- [ ] 再発防止策を safe-commands.md に追加

${VALUE_HIERARCHY}

---
> 🤖 この Issue は \`server_evolve.js v2.0\` によって自動生成されました。`,
            labels: ['bot: evolve-proposal', 'priority: next-session-warning'],
        });
    }

    // コンポーネント別提案（MR-01: count >= 2 の閾値を撤廃）
    for (const [component, count] of Object.entries(componentFreq).sort((a, b) => b[1] - a[1])) {
        const triggers = (triggerMap[component] || []).join(' / ') || '不明';
        const affectedWfs = Object.entries(wfFreq).map(([k]) => k).join(', ') || 'なし';

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
- \`data/dependency_map.json\` の \`hang_risk\` を更新
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
function execGH(cmd) {
    try {
        return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
        throw new Error(`gh execution failed: ${e.message}\n${e.stderr || ''}`);
    }
}

async function issueExists(title) {
    try {
        const out = execGH(`gh issue list --repo ${REPO_OWNER}/${REPO_NAME} --state open --label "bot: evolve-proposal" --limit 100 --json title`);
        const issues = JSON.parse(out);
        return issues.some(issue => issue.title === title);
    } catch (e) {
        console.warn(`  ⚠️  issueExistsチェック失敗: ${e.message}`);
        return false;
    }
}

async function createIssue(proposal) {
    if (await issueExists(proposal.title)) {
        console.log(`  ⏭️  スキップ: 重複Issue — ${proposal.title}`);
        return null;
    }

    try {
        // Write body to a temporary file to avoid shell escaping issues
        const tmpFile = path.join(os.tmpdir(), `gh_issue_body_${Date.now()}.md`);
        fs.writeFileSync(tmpFile, proposal.body, 'utf8');

        let labelsArg = '';
        if (proposal.labels && proposal.labels.length > 0) {
            labelsArg = proposal.labels.map(l => `--label "${l}"`).join(' ');
        }

        const cmd = `gh issue create --repo ${REPO_OWNER}/${REPO_NAME} --title "${proposal.title}" --body-file "${tmpFile}" ${labelsArg}`;
        const out = execGH(cmd);

        try { fs.unlinkSync(tmpFile); } catch (e) { }

        // Output of gh issue create is usually the URL of the new issue
        const urlMatch = out.match(/issues\/(\d+)/);
        const issueNum = urlMatch ? urlMatch[1] : '?';

        console.log(`  ✅ Issue作成: #${issueNum} — ${proposal.title}`);
        return { number: issueNum, url: out.trim() };
    } catch (e) {
        console.error(`  ❌ Issue作成失敗:`, e.message);
        return null;
    }
}

// ══════════════════════════════════════════
// メイン
// ══════════════════════════════════════════
async function main() {
    console.log('\n🤖 server_evolve.js v2.0 — 自律改善エンジン起動');
    console.log('   MR適用: MR-01 MR-07 MR-08 MR-09');
    console.log(`   モード: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`   リポジトリ: ${REPO_OWNER}/${REPO_NAME}\n`);

    // MR-09: NEXT_SESSION.md の警告を先に確認（能動的引き渡し）
    const nextSessionWarnings = collectNextSessionWarnings();
    if (nextSessionWarnings.length > 0) {
        console.log('🚨 NEXT_SESSION.md 警告を検出:');
        nextSessionWarnings.forEach(w => {
            console.log(`   ソース: ${w.source}`);
            w.lines.forEach(l => console.log(`   ${l}`));
        });
        console.log('');
    }

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

    const proposals = generateProposals(openIncidents, patterns, nextSessionWarnings);
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
