#!/usr/bin/env node
/**
 * git_context.js v3 — Gitドリブン・コンテキスト永続化エンジン
 * 
 * v2→v3:
 *   - Shell injection防御（shellEscape + commit-tree -F）
 *   - ensureCtxBranch安全化（git commit-tree直接、working tree不変）
 *   - タイムスタンプ秒精度 + 衝突回避
 *   - sh()廃止、エラー可視化
 *   - Fallback: mainにcommitしない（ログのみ）
 *   - CONTEXT_HEAD.jsonスキーマ統一
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

// ─── Security ──────────────────────────────────────

/** Shell-safe string escaping (single-quote wrapping) */
function esc(str) {
    if (typeof str !== 'string') return "''";
    return "'" + str.replace(/'/g, "'\\''") + "'";
}

// ─── Helpers ───────────────────────────────────────

function ensureDirs() {
    [CTX_DIR, SESSIONS, DECISIONS].forEach(d => fs.mkdirSync(d, { recursive: true }));
}

/**
 * Git command with explicit error handling.
 * Returns { ok, out, err }
 */
function git(cmd) {
    try {
        const out = execSync(`git ${cmd}`, {
            cwd: AG, encoding: 'utf8', timeout: 15000,
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
        return { ok: true, out };
    } catch (e) {
        return { ok: false, out: '', err: e.stderr?.trim() || e.message };
    }
}

/** Git command, return string or empty */
function gitS(cmd) { return git(cmd).out; }

/** Atomic write: tmp → rename (crash-safe) */
function atomicWrite(filepath, data) {
    const tmp = filepath + `.tmp.${process.pid}`;
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(tmp, data, 'utf8');
    fs.renameSync(tmp, filepath);
}

/** Timestamp with second precision + collision avoidance */
function ts() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const base = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    // Collision check
    const sessionPath = path.join(SESSIONS, `${base}.json`);
    if (!fs.existsSync(sessionPath)) return base;
    // Append counter
    for (let i = 1; i < 100; i++) {
        const candidate = `${base}_${i}`;
        if (!fs.existsSync(path.join(SESSIONS, `${candidate}.json`))) return candidate;
    }
    return `${base}_${Date.now()}`; // ultimate fallback
}

function iso() { return new Date().toISOString(); }
function readJSON(fp) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; } }
function curBranch() { return gitS('rev-parse --abbrev-ref HEAD') || 'unknown'; }
function curHash() { return gitS('rev-parse --short HEAD') || 'unknown'; }

function recentCommits(n) {
    // Use current branch's log
    const br = curBranch();
    const raw = gitS(`log ${br === 'unknown' ? '' : br} --oneline -${n}`);
    return raw ? raw.split('\n').filter(Boolean).map(l => {
        const [h, ...r] = l.split(' ');
        return { hash: h, msg: r.join(' ') };
    }) : [];
}

function listSessions() {
    if (!fs.existsSync(SESSIONS)) return [];
    return fs.readdirSync(SESSIONS).filter(f => f.endsWith('.json')).sort();
}

// ─── Orphan Branch (Safe — no working tree mutation) ──

/**
 * Create orphan branch using git plumbing commands.
 * Does NOT touch working tree or index. 100% safe.
 */
function ensureCtxBranch() {
    if (git(`rev-parse --verify ${CTX_BRANCH}`).ok) return;
    console.log(`🌱 Creating orphan branch: ${CTX_BRANCH}`);

    // Create empty tree → commit → ref. Zero working tree impact.
    const emptyTree = gitS('hash-object -t tree /dev/null');
    if (!emptyTree) {
        // Fallback: pipe empty input
        try {
            const tree = execSync('git mktree < /dev/null', {
                cwd: AG, encoding: 'utf8', shell: true, timeout: 5000
            }).trim();
            const commit = execSync(`git commit-tree ${tree} -m "ctx: init"`, {
                cwd: AG, encoding: 'utf8', timeout: 5000
            }).trim();
            gitS(`update-ref refs/heads/${CTX_BRANCH} ${commit}`);
        } catch (e) {
            console.error(`⚠️ Could not create ${CTX_BRANCH}: ${e.message}`);
            return;
        }
    } else {
        const r1 = git(`commit-tree ${emptyTree} -m "ctx: init"`);
        if (!r1.ok) { console.error(`⚠️ commit-tree failed: ${r1.err}`); return; }
        const r2 = git(`update-ref refs/heads/${CTX_BRANCH} ${r1.out}`);
        if (!r2.ok) { console.error(`⚠️ update-ref failed: ${r2.err}`); return; }
    }

    console.log(`✅ Branch ${CTX_BRANCH} created (working tree untouched)`);
}

/**
 * Commit files to ctx/log branch without touching working tree.
 * Uses GIT_INDEX_FILE + shell pipeline for reliability.
 * Commit message is passed via -F (file) to prevent injection.
 */
function commitToCtx(filePairs, message) {
    ensureCtxBranch();
    const ctxRef = git(`rev-parse ${CTX_BRANCH}`);
    if (!ctxRef.ok) { console.error(`⚠️ Cannot resolve ${CTX_BRANCH}`); return null; }

    const tmpIdx = path.join(os.tmpdir(), `ctx-idx-${process.pid}`);
    const tmpMsg = path.join(os.tmpdir(), `ctx-msg-${process.pid}`);
    const blobFiles = [];

    try {
        // Write commit message to file (shell injection prevention)
        fs.writeFileSync(tmpMsg, message, 'utf8');

        // Write blob contents to temp files
        for (const { relPath, content } of filePairs) {
            const tmp = path.join(os.tmpdir(), `ctx-blob-${process.pid}-${Buffer.from(relPath).toString('hex').slice(0, 20)}`);
            fs.writeFileSync(tmp, content, 'utf8');
            blobFiles.push({ tmp, relPath });
        }

        // Build safe shell pipeline
        let script = `export GIT_INDEX_FILE=${esc(tmpIdx)} && cd ${esc(AG)}`;
        script += ` && git read-tree ${ctxRef.out}`;

        for (const { tmp, relPath } of blobFiles) {
            script += ` && BLOB=$(git hash-object -w ${esc(tmp)})`;
            script += ` && git update-index --add --cacheinfo 100644,$BLOB,${esc(relPath)}`;
        }

        script += ` && TREE=$(git write-tree)`;
        script += ` && COMMIT=$(git commit-tree $TREE -p ${ctxRef.out} -F ${esc(tmpMsg)})`;
        script += ` && git update-ref refs/heads/${CTX_BRANCH} $COMMIT`;
        script += ` && echo $COMMIT`;

        const result = execSync(script, {
            cwd: AG, encoding: 'utf8', timeout: 15000,
            shell: '/bin/bash', stdio: ['pipe', 'pipe', 'pipe']
        }).trim();

        return result ? result.slice(0, 7) : null;
    } catch (e) {
        console.error(`⚠️ commitToCtx failed: ${e.stderr?.trim() || e.message}`);
        return null;
    } finally {
        // Cleanup all temp files
        [tmpIdx, tmpMsg, ...blobFiles.map(b => b.tmp)].forEach(f => {
            try { fs.unlinkSync(f); } catch { }
        });
    }
}

function readFromCtx(relPath) { return gitS(`show ${CTX_BRANCH}:${relPath}`); }

// ─── Unified HEAD Schema ───────────────────────────

function buildHead(ctx, lastDecision) {
    return {
        _v: '3.0',
        meta: ctx?.meta || { timestamp: iso() },
        session: ctx?.session || null,
        pending: ctx?.pending || [],
        decisions: ctx?.decisions || [],
        commits: ctx?.commits || [],
        next_session: ctx?.next_session || null,
        last_decision: lastDecision || ctx?.last_decision || null,
        updated_at: iso()
    };
}

// ─── Commands ──────────────────────────────────────

function cmdSnapshot() {
    ensureDirs();
    const now = ts();
    const state = readJSON(STATE_FILE);
    const next = (() => { try { return fs.readFileSync(NEXT_FILE, 'utf8').trim(); } catch { return ''; } })();

    const ctx = {
        _v: '3.0',
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
        next_session: next || null,
        last_decision: null
    };

    const head = buildHead(ctx);
    const json = JSON.stringify(ctx, null, 2);
    const headJson = JSON.stringify(head, null, 2);
    const sessionRel = `context-log/sessions/${now}.json`;
    const headRel = 'context-log/CONTEXT_HEAD.json';

    // 1. Filesystem
    atomicWrite(path.join(AG, sessionRel), json);
    atomicWrite(HEAD_FILE, headJson);

    // 2. ctx/log branch
    const h = commitToCtx([
        { relPath: sessionRel, content: json },
        { relPath: headRel, content: headJson }
    ], `ctx: snapshot ${now}`);

    if (h) {
        console.log(`✅ Snapshot → ${CTX_BRANCH}:${h}`);
    } else {
        // NO fallback to main. Files are on disk, that's enough.
        console.log(`⚠️ Git commit skipped (files saved to disk)`);
    }
    console.log(`   📁 ${now}.json (${json.length}b)`);
}

function cmdDecide(ctx, choice, reason) {
    if (!ctx || !choice) { console.error('❌ Usage: decide "<what>" "<choice>" "<why>"'); process.exit(1); }
    ensureDirs();

    const now = ts();
    const slug = ctx.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    const record = {
        _v: '3.0', timestamp: iso(), commit: curHash(),
        branch: curBranch(), context: ctx, choice, reason: reason || ''
    };
    const json = JSON.stringify(record, null, 2);
    const decRel = `context-log/decisions/${now}_${slug}.json`;
    atomicWrite(path.join(AG, decRel), json);

    // Unified HEAD update
    const existing = readJSON(HEAD_FILE) || {};
    const head = buildHead(existing, record);
    const headJson = JSON.stringify(head, null, 2);
    atomicWrite(HEAD_FILE, headJson);

    const h = commitToCtx([
        { relPath: decRel, content: json },
        { relPath: 'context-log/CONTEXT_HEAD.json', content: headJson }
    ], `ctx: ${ctx} → ${choice}`);

    if (h) { console.log(`📝 Decision → ${CTX_BRANCH}:${h}`); }
    else { console.log(`⚠️ Git commit skipped (files saved to disk)`); }
    console.log(`   🎯 ${ctx} → ${choice}`);

    // Sync session state
    try {
        const s = readJSON(STATE_FILE);
        if (s) {
            (s.design_decisions = s.design_decisions || []).push({
                context: ctx, decision: choice, reason, timestamp: iso()
            });
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
        console.log(`✅ Restored from ${CTX_BRANCH}`);
        console.log(fromBranch);
        return JSON.parse(fromBranch);
    }
    // Layer 3: latest session on disk
    const ss = listSessions();
    if (ss.length > 0) {
        const d = readJSON(path.join(SESSIONS, ss[ss.length - 1]));
        if (d) {
            const head = buildHead(d);
            atomicWrite(HEAD_FILE, JSON.stringify(head, null, 2));
            console.log(`✅ Restored from ${ss[ss.length - 1]}`);
            console.log(JSON.stringify(head, null, 2));
            return head;
        }
    }
    // Layer 4: main HEAD (JSON only, no YAML compat)
    const restored = gitS('show HEAD:context-log/CONTEXT_HEAD.json');
    if (restored) {
        ensureDirs(); atomicWrite(HEAD_FILE, restored);
        console.log('✅ Restored from main HEAD');
        console.log(restored);
        return JSON.parse(restored);
    }
    console.log('ℹ️ No context history.');
    return null;
}

function cmdRecover(id) {
    if (!id || id === 'latest') {
        const ss = listSessions();
        if (!ss.length) { console.log('ℹ️ No sessions.'); return; }
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
    // Safe grep in git log
    const commits = gitS(`log --all --oneline --grep=${esc(kw)} -10`);
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
        const log = gitS(`log ${CTX_BRANCH} --oneline -${n}`) || gitS('log --oneline --grep="ctx:" -20');
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
            console.log('🧠 git_context.js v3');
            console.log('  init | snapshot | decide | restore | recover | search | timeline | prune');
    }
} catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
}
