#!/usr/bin/env node
/**
 * DRG Bootstrap — Scan connected services and populate data_graph.json
 * 
 * Scans your GitHub repos (via MCP or API) and creates a starter DRG.
 * Each user's data_graph.json is personal and NOT committed to git.
 * 
 * Usage:
 *   node bootstrap_drg.js                    # Interactive scan
 *   node bootstrap_drg.js --github-user=USER # Specify GitHub user
 * 
 * Prerequisites:
 *   - data_graph.template.json must exist (copied to data_graph.json if missing)
 *   - GitHub MCP configured, or GITHUB_TOKEN env var set
 */

const drg = require('./drg.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DRG_DIR = process.env.ANTIGRAVITY_DIR || path.join(os.homedir(), '.antigravity');
const DRG_PATH = path.join(DRG_DIR, 'data', 'data_graph.json');
const TEMPLATE_PATH = path.join(DRG_DIR, 'data_graph.template.json');

// ─── Parse CLI args ──────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, arg) => {
    const [k, v] = arg.replace('--', '').split('=');
    acc[k] = v || true;
    return acc;
}, {});

// ─── Ensure data_graph.json exists ───────────────────────
function ensureDRGFile() {
    if (!fs.existsSync(DRG_PATH)) {
        if (fs.existsSync(TEMPLATE_PATH)) {
            fs.copyFileSync(TEMPLATE_PATH, DRG_PATH);
            console.log('📄 Created data_graph.json from template');
        } else {
            console.error('❌ Neither data_graph.json nor template found. Run from ~/.antigravity/');
            process.exit(1);
        }
    }
}

// ─── GitHub Scan (via gh CLI) ─────────────────────────
function scanGitHub(username) {
    console.log(`\n📂 Scanning GitHub repos for ${username}...`);
    const { execSync } = require('child_process');
    const repos = [];
    let page = 1;

    while (true) {
        let output;
        try {
            output = execSync(
                `gh api "users/${username}/repos?per_page=100&page=${page}&sort=updated" --jq '.'`,
                { encoding: 'utf8', timeout: 30000 }
            );
        } catch (err) {
            console.error(`❌ GitHub API error (gh): ${err.message}`);
            break;
        }

        const data = JSON.parse(output);
        if (!data || data.length === 0) break;
        repos.push(...data);
        page++;
    }

    return repos.map(r => ({
        project: {
            id: `proj:${r.name.toLowerCase()}`,
            type: 'project',
            label: r.name,
            status: r.archived ? 'archived' : 'active',
        },
        repo: {
            id: `repo:${r.full_name}`,
            type: 'repo',
            label: `${r.name} (GitHub)`,
            url: r.html_url,
        },
        edge: {
            from: `proj:${r.name.toLowerCase()}`,
            to: `repo:${r.full_name}`,
            relation: 'implements',
        }
    }));
}

// ─── Bootstrap ───────────────────────────────────────────
async function bootstrap() {
    console.log('🚀 DRG Bootstrap starting...\n');

    ensureDRGFile();
    let data = drg.readDRG(true); // Backup first
    if (!data) {
        console.error('Failed to read DRG. Aborting.');
        process.exit(1);
    }

    // GitHub scan
    const githubUser = args['github-user'] || args['github_user'];
    if (githubUser) {
        const results = await scanGitHub(githubUser);
        console.log(`  Found ${results.length} repos\n`);

        for (const r of results) {
            try { drg.addNode(data, r.project); } catch { }
            try { drg.addNode(data, r.repo); } catch { }
            try { drg.addEdge(data, r.edge); } catch { }
        }

        // Auto-detect correlations by name patterns
        const projects = data.nodes.filter(n => n.type === 'project');
        const nameGroups = {};
        for (const p of projects) {
            // Group by common prefixes/suffixes
            const name = p.label.toLowerCase();
            for (const suffix of ['-buddy', 'antigravity', 'discord']) {
                if (name.includes(suffix)) {
                    if (!nameGroups[suffix]) nameGroups[suffix] = [];
                    nameGroups[suffix].push(p.id);
                }
            }
        }

        for (const [pattern, entities] of Object.entries(nameGroups)) {
            if (entities.length >= 2) {
                data.correlations = data.correlations || [];
                data.correlations.push({
                    entities,
                    type: 'name_pattern',
                    detected_by: 'L1:name_match',
                    confidence: 0.85,
                    evidence: `Shared pattern: "${pattern}"`
                });
            }
        }
    } else {
        console.log('⚠️  No --github-user specified. Skipping GitHub scan.');
        console.log('   Usage: node bootstrap_drg.js --github-user=YOUR_USERNAME\n');
    }

    // Add infrastructure nodes
    const infraNodes = [
        { id: 'infra:antigravity', type: 'component', label: 'Antigravity Dev Environment' },
    ];
    for (const i of infraNodes) {
        try { drg.addNode(data, i); } catch { }
    }

    // Write
    console.log('\n💾 Writing DRG...');
    const success = drg.writeDRG(data);
    if (success) {
        console.log('✅ DRG Bootstrap complete!');
        console.log(`\n📊 Stats:`);
        console.log(`   Nodes: ${data.nodes.length}`);
        console.log(`   Edges: ${data.edges.length}`);
        console.log(`   Correlations: ${(data.correlations || []).length}`);
    } else {
        console.error('❌ DRG write failed!');
        process.exit(1);
    }
}

bootstrap().catch(err => {
    console.error('❌ Bootstrap error:', err.message);
    process.exit(1);
});
