#!/usr/bin/env node

/**
 * git_context.js — Gitドリブン・コンテキスト永続化エンジン
 * 
 * Git commit historyをコンテキストの永続ストレージとして活用。
 * 一度commitされたコンテキストは物理的に削除不可能。
 * 
 * Commands:
 *   snapshot                              セッションコンテキストをcommit
 *   decide "<ctx>" "<decision>" "<reason>" 設計判断を記録してcommit
 *   restore                               最新コンテキストを復元表示
 *   recover [session_id|latest]            セッションコンテキストを完全復元
 *   search "<keyword>"                     コンテキスト横断検索
 *   timeline [n]                           直近nセッションの変遷表示
 *   prune [days]                           古いエントリーを整理（Git historyには残る）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Configuration ─────────────────────────────────
const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const CONTEXT_DIR = path.join(ANTIGRAVITY_DIR, 'context-log');
const SESSIONS_DIR = path.join(CONTEXT_DIR, 'sessions');
const DECISIONS_DIR = path.join(CONTEXT_DIR, 'decisions');
const CONTEXT_HEAD = path.join(CONTEXT_DIR, 'CONTEXT_HEAD.yaml');
const SESSION_STATE = path.join(ANTIGRAVITY_DIR, '.session_state.json');
const NEXT_SESSION = path.join(ANTIGRAVITY_DIR, 'NEXT_SESSION.md');

// ─── Helpers ───────────────────────────────────────

function ensureDirs() {
    [CONTEXT_DIR, SESSIONS_DIR, DECISIONS_DIR].forEach(d => {
        fs.mkdirSync(d, { recursive: true });
    });
}

function git(cmd, opts = {}) {
    try {
        return execSync(`git ${cmd}`, {
            cwd: ANTIGRAVITY_DIR,
            encoding: 'utf8',
            timeout: 10000,
            ...opts
        }).trim();
    } catch (err) {
        if (!opts.silent) console.error(`⚠️ git ${cmd}: ${err.message}`);
        return '';
    }
}

function timestamp() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function isoNow() { return new Date().toISOString(); }

function readSessionState() {
    try {
        if (fs.existsSync(SESSION_STATE)) return JSON.parse(fs.readFileSync(SESSION_STATE, 'utf8'));
    } catch (e) { /* ignore */ }
    return null;
}

function readNextSession() {
    try {
        if (fs.existsSync(NEXT_SESSION)) return fs.readFileSync(NEXT_SESSION, 'utf8').trim();
    } catch (e) { /* ignore */ }
    return '';
}

function getCurrentBranch() {
    return git('rev-parse --abbrev-ref HEAD', { silent: true }) || 'unknown';
}

function getLastCommitHash() {
    return git('rev-parse --short HEAD', { silent: true }) || 'unknown';
}

function getRecentCommits(n = 10) {
    const raw = git(`log --oneline -${n}`, { silent: true });
    if (!raw) return [];
    return raw.split('\n').filter(Boolean).map(line => {
        const [hash, ...rest] = line.split(' ');
        return { hash, message: rest.join(' ') };
    });
}

/**
 * 依存ゼロのYAMLシリアライザ
 */
function toYaml(obj, indent = 0) {
    const pad = ' '.repeat(indent);
    let out = '';
    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) {
            out += `${pad}${key}: null\n`;
        } else if (Array.isArray(value)) {
            if (value.length === 0) {
                out += `${pad}${key}: []\n`;
            } else if (typeof value[0] === 'object') {
                out += `${pad}${key}:\n`;
                value.forEach(item => {
                    const lines = toYaml(item, indent + 4).split('\n').filter(Boolean);
                    lines.forEach((line, i) => {
                        out += i === 0 ? `${pad}  - ${line.trim()}\n` : `${pad}    ${line.trim()}\n`;
                    });
                });
            } else {
                out += `${pad}${key}:\n`;
                value.forEach(item => { out += `${pad}  - ${JSON.stringify(item)}\n`; });
            }
        } else if (typeof value === 'object') {
            out += `${pad}${key}:\n${toYaml(value, indent + 2)}`;
        } else if (typeof value === 'string' && value.includes('\n')) {
            out += `${pad}${key}: |\n`;
            value.split('\n').forEach(line => { out += `${pad}  ${line}\n`; });
        } else {
            out += `${pad}${key}: ${value}\n`;
        }
    }
    return out;
}

function listSessions() {
    if (!fs.existsSync(SESSIONS_DIR)) return [];
    return fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.yaml')).sort();
}

// ─── Core Commands ─────────────────────────────────

function snapshot() {
    ensureDirs();
    const sessionState = readSessionState();
    const nextSession = readNextSession();
    const ts = timestamp();
    const commitHash = getLastCommitHash();
    const branch = getCurrentBranch();
    const recentCommits = getRecentCommits(15);

    const context = {
        meta: {
            session_id: ts, timestamp: isoNow(), branch, commit: commitHash, schema_version: '1.0'
        },
        session: sessionState ? {
            workflow: sessionState.current?.workflow || null,
            phase: sessionState.current?.phase || null,
            project: sessionState.current?.project || null,
            project_path: sessionState.current?.project_path || null,
            autonomy_level: sessionState.autonomy_level || 2,
            workflows_executed: sessionState.metrics?.workflows_executed || 0,
            tasks_completed: sessionState.metrics?.tasks_completed || 0
        } : { note: 'no active session' },
        pending_tasks: sessionState?.pending_tasks?.filter(t => t.status !== 'done') || [],
        design_decisions: sessionState?.design_decisions || [],
        recent_commits: recentCommits.slice(0, 10),
        next_session: nextSession || 'none'
    };

    const yaml = `# Context Snapshot: ${ts}\n# Commit: ${commitHash}\n\n${toYaml(context)}`;

    // 1. Session file
    const sessionFile = path.join(SESSIONS_DIR, `${ts}.yaml`);
    fs.writeFileSync(sessionFile, yaml, 'utf8');

    // 2. CONTEXT_HEAD (always latest)
    fs.writeFileSync(CONTEXT_HEAD, yaml, 'utf8');

    // 3. Git commit
    git('add -f context-log/');
    const result = git(`commit -m "ctx: snapshot ${ts}" --no-verify`, { silent: true });

    if (result) {
        console.log(`✅ Context snapshot committed: ${ts}`);
        console.log(`   📁 ${path.basename(sessionFile)}`);
        console.log(`   🔗 ${getLastCommitHash()}`);
    } else {
        console.log(`ℹ️ No context changes to commit`);
    }
}

function decide(ctx, decision, reason) {
    if (!ctx || !decision) {
        console.error('❌ Usage: decide "<context>" "<decision>" "<reason>"');
        process.exit(1);
    }
    ensureDirs();

    const ts = timestamp();
    const slug = ctx.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

    const record = {
        meta: { timestamp: isoNow(), commit: getLastCommitHash(), branch: getCurrentBranch() },
        decision: { context: ctx, choice: decision, reason: reason || 'not specified' }
    };

    const yaml = `# Decision: ${ctx}\n# ${isoNow()}\n\n${toYaml(record)}`;
    const filepath = path.join(DECISIONS_DIR, `${ts}_${slug}.yaml`);
    fs.writeFileSync(filepath, yaml, 'utf8');

    // Update CONTEXT_HEAD
    const headContent = fs.existsSync(CONTEXT_HEAD) ? fs.readFileSync(CONTEXT_HEAD, 'utf8') : '';
    const appendix = `\n# Latest Decision (${isoNow()})\nlast_decision:\n  context: ${ctx}\n  choice: ${decision}\n  reason: ${reason || '-'}\n`;
    fs.writeFileSync(CONTEXT_HEAD, headContent + appendix, 'utf8');

    // Git commit
    git('add -f context-log/');
    git(`commit -m "ctx: ${ctx} → ${decision}" --no-verify`, { silent: true });

    console.log(`📝 Decision committed: ${ctx} → ${decision}`);
    console.log(`   🔗 ${getLastCommitHash()}`);

    // Sync to session_state.js
    try {
        const state = readSessionState();
        if (state) {
            state.design_decisions = state.design_decisions || [];
            state.design_decisions.push({ context: ctx, decision, reason, timestamp: isoNow(), git_commit: getLastCommitHash() });
            state.updated_at = isoNow();
            fs.writeFileSync(SESSION_STATE, JSON.stringify(state, null, 2), 'utf8');
        }
    } catch (e) { /* non-critical */ }
}

function restore() {
    // 1. CONTEXT_HEAD on disk
    if (fs.existsSync(CONTEXT_HEAD)) {
        const content = fs.readFileSync(CONTEXT_HEAD, 'utf8');
        console.log('🔄 Context restored from CONTEXT_HEAD.yaml');
        console.log('─'.repeat(50));
        console.log(content);
        return;
    }

    // 2. Git history fallback
    console.log('⚠️ CONTEXT_HEAD not found. Restoring from Git...');
    const restored = git('show HEAD:context-log/CONTEXT_HEAD.yaml', { silent: true });
    if (restored) {
        ensureDirs();
        fs.writeFileSync(CONTEXT_HEAD, restored, 'utf8');
        console.log('✅ Restored from Git history');
        console.log('─'.repeat(50));
        console.log(restored);
        return;
    }

    // 3. Latest session file
    const sessions = listSessions();
    if (sessions.length > 0) {
        const latest = sessions[sessions.length - 1];
        const content = fs.readFileSync(path.join(SESSIONS_DIR, latest), 'utf8');
        console.log(`✅ Restored from session: ${latest}`);
        console.log('─'.repeat(50));
        console.log(content);
        return;
    }

    console.log('ℹ️ No context history found. Fresh start.');
}

function recover(sessionId) {
    if (!sessionId || sessionId === 'latest') {
        const sessions = listSessions();
        if (sessions.length === 0) {
            console.log('ℹ️ No sessions found.');
            return;
        }
        sessionId = sessions[sessions.length - 1].replace('.yaml', '');
    }

    const filepath = path.join(SESSIONS_DIR, `${sessionId}.yaml`);
    if (fs.existsSync(filepath)) {
        console.log(`✅ Session recovered: ${sessionId}`);
        console.log('─'.repeat(50));
        console.log(fs.readFileSync(filepath, 'utf8'));
    } else {
        // Git fallback
        const content = git(`show HEAD:context-log/sessions/${sessionId}.yaml`, { silent: true });
        if (content) {
            console.log(`✅ Recovered from Git: ${sessionId}`);
            console.log('─'.repeat(50));
            console.log(content);
        } else {
            console.log(`❌ Session not found: ${sessionId}`);
        }
    }
}

function search(keyword) {
    if (!keyword) { console.error('❌ Usage: search "<keyword>"'); process.exit(1); }
    console.log(`🔍 Searching: "${keyword}"`);
    console.log('─'.repeat(50));

    let found = 0;
    for (const dir of [SESSIONS_DIR, DECISIONS_DIR]) {
        if (!fs.existsSync(dir)) continue;
        for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.yaml'))) {
            const content = fs.readFileSync(path.join(dir, file), 'utf8');
            if (content.toLowerCase().includes(keyword.toLowerCase())) {
                const lines = content.split('\n').filter(l => l.toLowerCase().includes(keyword.toLowerCase())).slice(0, 3);
                console.log(`\n📄 ${path.basename(dir)}/${file}`);
                lines.forEach(l => console.log(`   ${l.trim()}`));
                found++;
            }
        }
    }

    // Git commit messages
    const commits = git(`log --all --oneline --grep="${keyword}"`, { silent: true });
    if (commits) {
        const ctx = commits.split('\n').filter(l => l.includes('ctx:'));
        if (ctx.length > 0) {
            console.log('\n📌 Context Commits:');
            ctx.slice(0, 10).forEach(l => console.log(`   ${l}`));
            found += ctx.length;
        }
    }
    console.log(`\n✅ ${found} result(s)`);
}

function timeline(n = 10) {
    console.log(`📊 Context Timeline (last ${n})`);
    console.log('═'.repeat(60));

    const sessions = listSessions().slice(-n);
    if (sessions.length === 0) {
        const gitLog = git('log --oneline --grep="ctx:" -20', { silent: true });
        if (gitLog) {
            console.log('(from Git history)\n');
            gitLog.split('\n').filter(Boolean).forEach(l => console.log(`  ${l}`));
        } else {
            console.log('ℹ️ No history found.');
        }
        return;
    }

    sessions.forEach(file => {
        const content = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf8');
        const id = file.replace('.yaml', '');
        const wf = (content.match(/workflow:\s*(.+)/) || [, '-'])[1];
        const proj = (content.match(/project:\s*(.+)/) || [, '-'])[1];
        console.log(`\n┌ 📅 ${id}`);
        console.log(`│  WF: ${wf}  │  Project: ${proj}`);
        console.log(`└${'─'.repeat(58)}`);
    });
}

function prune(keepDays = 30) {
    const cutoff = Date.now() - (keepDays * 24 * 60 * 60 * 1000);
    let removed = 0;
    [SESSIONS_DIR, DECISIONS_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) return;
        fs.readdirSync(dir).forEach(f => {
            const fp = path.join(dir, f);
            if (fs.statSync(fp).mtimeMs < cutoff) { fs.unlinkSync(fp); removed++; }
        });
    });
    if (removed > 0) {
        git('add -f context-log/');
        git(`commit -m "ctx: prune ${removed} entries (${keepDays}d+)" --no-verify`, { silent: true });
        console.log(`🗑️ Pruned ${removed} old entries (still in Git history)`);
    } else {
        console.log(`ℹ️ Nothing to prune.`);
    }
}

// ─── CLI ───────────────────────────────────────────
const [, , command, ...args] = process.argv;

switch (command) {
    case 'snapshot': snapshot(); break;
    case 'decide': decide(args[0], args[1], args[2]); break;
    case 'restore': restore(); break;
    case 'recover': recover(args[0]); break;
    case 'search': search(args[0]); break;
    case 'timeline': timeline(parseInt(args[0]) || 10); break;
    case 'prune': prune(parseInt(args[0]) || 30); break;
    default:
        console.log(`🧠 git_context.js — Gitドリブン・コンテキスト永続化エンジン\n`);
        console.log(`Commands:`);
        console.log(`  snapshot                               スナップショットcommit`);
        console.log(`  decide "<ctx>" "<decision>" "<reason>"  設計判断をcommit`);
        console.log(`  restore                                最新コンテキスト復元`);
        console.log(`  recover [session_id|latest]             セッション復元`);
        console.log(`  search "<keyword>"                      横断検索`);
        console.log(`  timeline [n]                            変遷表示`);
        console.log(`  prune [days]                            古いエントリ整理`);
        break;
}
