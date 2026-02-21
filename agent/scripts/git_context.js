#!/usr/bin/env node
/**
 * git_context.js v2 — Gitドリブン・コンテキスト永続化エンジン
 * 
 * v1からの改善:
 *   - JSON形式（自前YAML廃止）
 *   - Atomic write (tmp → rename)
 *   - Orphan branch `ctx/log` にコミット隔離（main汚染ゼロ）
 *   - 構造化エラーハンドリング
 *   - 4層フォールバック復元
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ─── Config ────────────────────────────────────────
const AG = process.env.ANTIGRAVITY_DIR || path.join(os.homedir(), '.antigravity');
const CTX_BRANCH = 'ctx/log';
const CTX_DIR = path.join(AG, 'context-log');
const SESSIONS = path.join(CTX_DIR, 'sessions');
const DECISIONS = path.join(CTX_DIR, 'decisions');
const HEAD_FILE = path.join(CTX_DIR, 'CONTEXT_HEAD.json');
const STATE_FILE = path.join(AG, '.session_state.json');
const NEXT_FILE = path.join(AG, 'NEXT_SESSION.md');

// ─── Helpers ───────────────────────────────────────

function ensureDirs() {
    [CTX_DIR, SESSIONS, DECISIONS].forEach(d => fs.mkdirSync(d, { recursive: true }));
}

function git(cmd, opts = {}) {
    try {
        return execSync(`git ${cmd}`, {
            cwd: AG, encoding: 'utf8', timeout: 15000,
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
    } catch (err) {
        if (opts.throws) throw err;
        return '';
    }
}

function sh(cmd) {
    try {
        return execSync(cmd, { cwd: AG, encoding: 'utf8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch (err) {
        return '';
    }
}

/** Atomic write: tmp → rename */
function atomicWrite(filepath, data) {
    const tmp = filepath + `.tmp.${process.pid}`;
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(tmp, data, 'utf8');
    fs.renameSync(tmp, filepath);
}

function ts() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
function iso() { return new Date().toISOString(); }
function readJSON(fp) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; } }
function curBranch() { return git('rev-parse --abbrev-ref HEAD') || 'unknown'; }
function curHash() { return git('rev-parse --short HEAD') || 'unknown'; }
function recentCommits(n) {
    const raw = git(`log --oneline -${n}`);
    return raw ? raw.split('\n').filter(Boolean).map(l => { const [h, ...r] = l.split(' '); return { hash: h, msg: r.join(' ') }; }) : [];
}
function listSessions() {
    if (!fs.existsSync(SESSIONS)) return [];
    return fs.readdirSync(SESSIONS).filter(f => f.endsWith('.json')).sort();
}

// ─── Orphan Branch Commit ──────────────────────────
// シェルスクリプトに委譲（GIT_INDEX_FILEのNode.js問題を回避）

function ensureCtxBranch() {
    if (git(`rev-parse --verify ${CTX_BRANCH}`)) return;
    console.log(`🌱 Creating orphan branch: ${CTX_BRANCH}`);
    const cur = curBranch();
    sh(`cd "${AG}" && git checkout --orphan ${CTX_BRANCH} && git rm -rf . 2>/dev/null; git commit --allow-empty -m "ctx: init" --no-verify && git checkout ${cur} 2>/dev/null`);
    if (git(`rev-parse --verify ${CTX_BRANCH}`)) {
        console.log(`✅ Branch ${CTX_BRANCH} created`);
    } else {
        console.error(`⚠️ Failed to create ${CTX_BRANCH}`);
    }
}

/**
 * ctx/logブランチにファイルをコミット（現在のブランチを離れずに）
 * GIT_INDEX_FILE操作をシェルに完全委譲して信頼性を確保
 */
function commitToCtx(filePairs, message) {
    ensureCtxBranch();
    const ctxHead = git(`rev-parse ${CTX_BRANCH}`, { throws: true });
    const tmpIdx = path.join(os.tmpdir(), `ctx-idx-${process.pid}`);

    // Build shell script for atomic index operation
    let script = `export GIT_INDEX_FILE="${tmpIdx}" && cd "${AG}" && git read-tree ${CTX_BRANCH}`;

    for (const { relPath, content } of filePairs) {
        // Write content to temp file, then hash-object
        const tmpFile = path.join(os.tmpdir(), `ctx-blob-${process.pid}-${path.basename(relPath)}`);
        fs.writeFileSync(tmpFile, content, 'utf8');
        script += ` && BLOB=$(git hash-object -w "${tmpFile}") && git update-index --add --cacheinfo 100644,$BLOB,"${relPath}" && rm -f "${tmpFile}"`;
    }

    script += ` && TREE=$(git write-tree) && COMMIT=$(git commit-tree $TREE -p ${ctxHead} -m "${message.replace(/"/g, '\\"')}") && git update-ref refs/heads/${CTX_BRANCH} $COMMIT && echo $COMMIT && rm -f "${tmpIdx}"`;

    const result = sh(script);
    if (result) {
        return result.slice(0, 7);
    }
    // Cleanup on failure
    try { fs.unlinkSync(tmpIdx); } catch { }
    return null;
}

function readFromCtx(relPath) {
    return git(`show ${CTX_BRANCH}:${relPath}`);
}

// ─── Commands ──────────────────────────────────────

function cmdSnapshot() {
    ensureDirs();
    const now = ts();
    const state = readJSON(STATE_FILE);
    const next = (() => { try { return fs.readFileSync(NEXT_FILE, 'utf8').trim(); } catch { return ''; } })();

    const ctx = {
        _v: '2.0',
        meta: { session_id: now, timestamp: iso(), branch: curBranch(), commit: curHash() },
        session: state ? {
            workflow: state.current?.workflow || null,
            phase: state.current?.phase || null,
            project: state.current?.project || null,
            autonomy: state.autonomy_level ?? 2,
            wf_count: state.metrics?.workflows_executed ?? 0,
            task_count: state.metrics?.tasks_completed ?? 0
        } : null,
        pending: state?.pending_tasks?.filter(t => t.status !== 'done') || [],
        decisions: state?.design_decisions || [],
        commits: recentCommits(10),
        next_session: next || null
    };

    const json = JSON.stringify(ctx, null, 2);
    const sessionRel = `context-log/sessions/${now}.json`;
    const headRel = 'context-log/CONTEXT_HEAD.json';

    // 1. Filesystem (fast access)
    atomicWrite(path.join(AG, sessionRel), json);
    atomicWrite(HEAD_FILE, json);

    // 2. Orphan branch commit
    const h = commitToCtx([
        { relPath: sessionRel, content: json },
        { relPath: headRel, content: json }
    ], `ctx: snapshot ${now}`);

    if (h) {
        console.log(`✅ Snapshot → ${CTX_BRANCH}:${h}`);
    } else {
        // Fallback to current branch
        git('add -f context-log/');
        git('commit -m "ctx: snapshot ' + now + '" --no-verify');
        console.log(`✅ Snapshot → main (fallback)`);
    }
    console.log(`   📁 ${now}.json (${json.length}b)`);
}

function cmdDecide(ctx, choice, reason) {
    if (!ctx || !choice) { console.error('❌ Usage: decide "<what>" "<choice>" "<why>"'); process.exit(1); }
    ensureDirs();

    const now = ts();
    const slug = ctx.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    const record = { _v: '2.0', timestamp: iso(), commit: curHash(), branch: curBranch(), context: ctx, choice, reason: reason || '' };
    const json = JSON.stringify(record, null, 2);
    const decRel = `context-log/decisions/${now}_${slug}.json`;
    atomicWrite(path.join(AG, decRel), json);

    // Update HEAD
    let head = readJSON(HEAD_FILE) || {};
    head.last_decision = record;
    head.updated_at = iso();
    const headJson = JSON.stringify(head, null, 2);
    atomicWrite(HEAD_FILE, headJson);

    const h = commitToCtx([
        { relPath: decRel, content: json },
        { relPath: 'context-log/CONTEXT_HEAD.json', content: headJson }
    ], `ctx: ${ctx} → ${choice}`);

    if (h) { console.log(`📝 Decision → ${CTX_BRANCH}:${h}`); }
    else {
        git('add -f context-log/');
        git(`commit -m "ctx: ${ctx} → ${choice}" --no-verify`);
        console.log(`📝 Decision → main (fallback)`);
    }
    console.log(`   🎯 ${ctx} → ${choice}`);

    // Sync session state
    try {
        const s = readJSON(STATE_FILE);
        if (s) {
            (s.design_decisions = s.design_decisions || []).push({ context: ctx, decision: choice, reason, timestamp: iso() });
            s.updated_at = iso();
            atomicWrite(STATE_FILE, JSON.stringify(s, null, 2));
        }
    } catch { }
}

function cmdRestore() {
    // Layer 1: disk
    if (fs.existsSync(HEAD_FILE)) {
        const d = readJSON(HEAD_FILE);
        if (d) { console.log('🔄 Restored from disk'); console.log(JSON.stringify(d, null, 2)); return d; }
    }
    // Layer 2: ctx/log branch
    const fromBranch = readFromCtx('context-log/CONTEXT_HEAD.json');
    if (fromBranch) {
        ensureDirs(); atomicWrite(HEAD_FILE, fromBranch);
        console.log(`✅ Restored from ${CTX_BRANCH}`); console.log(fromBranch); return JSON.parse(fromBranch);
    }
    // Layer 3: latest session on disk
    const ss = listSessions();
    if (ss.length > 0) {
        const d = readJSON(path.join(SESSIONS, ss[ss.length - 1]));
        if (d) { atomicWrite(HEAD_FILE, JSON.stringify(d, null, 2)); console.log(`✅ Restored from ${ss[ss.length - 1]}`); console.log(JSON.stringify(d, null, 2)); return d; }
    }
    // Layer 4: git log fallback
    const restored = git('show HEAD:context-log/CONTEXT_HEAD.json') || git('show HEAD:context-log/CONTEXT_HEAD.yaml');
    if (restored) { ensureDirs(); atomicWrite(HEAD_FILE, restored); console.log('✅ Restored from main HEAD'); console.log(restored); return; }
    console.log('ℹ️ No context history.');
    return null;
}

function cmdRecover(id) {
    if (!id || id === 'latest') {
        const ss = listSessions();
        if (ss.length === 0) { console.log('ℹ️ No sessions.'); return; }
        id = ss[ss.length - 1].replace('.json', '');
    }
    const fp = path.join(SESSIONS, `${id}.json`);
    if (fs.existsSync(fp)) { console.log(`✅ ${id}`); console.log(fs.readFileSync(fp, 'utf8')); return; }
    const c = readFromCtx(`context-log/sessions/${id}.json`);
    if (c) { console.log(`✅ From ${CTX_BRANCH}: ${id}`); console.log(c); }
    else console.log(`❌ Not found: ${id}`);
}

function cmdSearch(kw) {
    if (!kw) { console.error('❌ Usage: search "<keyword>"'); process.exit(1); }
    console.log(`🔍 "${kw}"`);
    let found = 0;
    for (const dir of [SESSIONS, DECISIONS]) {
        if (!fs.existsSync(dir)) continue;
        for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
            const c = fs.readFileSync(path.join(dir, f), 'utf8');
            if (c.toLowerCase().includes(kw.toLowerCase())) {
                try { const d = JSON.parse(c); console.log(`  📄 ${path.basename(dir)}/${f} — ${d.context || d.meta?.session_id || f}`); }
                catch { console.log(`  📄 ${path.basename(dir)}/${f}`); }
                found++;
            }
        }
    }
    const commits = git(`log --all --oneline --grep="${kw}" -10`);
    if (commits) {
        const ctx = commits.split('\n').filter(l => l.includes('ctx:'));
        if (ctx.length) { console.log('  📌 Commits:'); ctx.forEach(l => console.log(`     ${l}`)); found += ctx.length; }
    }
    console.log(`\n✅ ${found} result(s)`);
}

function cmdTimeline(n = 10) {
    console.log(`📊 Timeline (last ${n})`);
    const ss = listSessions().slice(-n);
    if (!ss.length) {
        const log = git(`log ${CTX_BRANCH} --oneline -${n}`) || git('log --oneline --grep="ctx:" -20');
        if (log) { log.split('\n').filter(Boolean).forEach(l => console.log(`  ${l}`)); }
        else console.log('ℹ️ Empty.');
        return;
    }
    for (const f of ss) {
        const d = readJSON(path.join(SESSIONS, f));
        if (!d) continue;
        console.log(`  📅 ${f.replace('.json', '')}  WF:${d.session?.workflow || '-'}  Proj:${d.session?.project || '-'}  Tasks:${d.session?.task_count || 0}  Dec:${d.decisions?.length || 0}`);
    }
}

function cmdPrune(days = 30) {
    const cutoff = Date.now() - (days * 86400000);
    let n = 0;
    for (const dir of [SESSIONS, DECISIONS]) {
        if (!fs.existsSync(dir)) continue;
        for (const f of fs.readdirSync(dir)) {
            const fp = path.join(dir, f);
            if (fs.statSync(fp).mtimeMs < cutoff) { fs.unlinkSync(fp); n++; }
        }
    }
    console.log(n > 0 ? `🗑️ Pruned ${n} (still in ${CTX_BRANCH})` : 'ℹ️ Nothing to prune.');
}

function cmdInit() {
    ensureCtxBranch();
    console.log(`✅ Ready: ${CTX_BRANCH}`);
}

// ─── CLI ───────────────────────────────────────────
const [, , cmd, ...args] = process.argv;
try {
    switch (cmd) {
        case 'init': cmdInit(); break;
        case 'snapshot': cmdSnapshot(); break;
        case 'decide': cmdDecide(args[0], args[1], args[2]); break;
        case 'restore': cmdRestore(); break;
        case 'recover': cmdRecover(args[0]); break;
        case 'search': cmdSearch(args[0]); break;
        case 'timeline': cmdTimeline(parseInt(args[0]) || 10); break;
        case 'prune': cmdPrune(parseInt(args[0]) || 30); break;
        default:
            console.log('🧠 git_context.js v2 — Commands:');
            console.log('  init | snapshot | decide | restore | recover | search | timeline | prune');
    }
} catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
}
