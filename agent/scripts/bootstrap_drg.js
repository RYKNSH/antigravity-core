#!/usr/bin/env node
/**
 * DRG Bootstrap — Scan all services and populate data_graph.json
 * 
 * This script is meant to be run ONCE during initial DRG setup.
 * After initial population, DRG is updated incrementally.
 * 
 * Usage: node bootstrap_drg.js
 */

const drg = require('./drg.js');

// ============================================================
// DATA: Extracted from GitHub API + Chatwork API + known structure
// ============================================================

const PROJECTS = [
    {
        id: 'proj:secretary-buddy',
        type: 'project',
        label: 'Secretary Buddy',
        status: 'active',
        sources: {
            github: 'RYKNSH/secretary-buddy',
            local: '~/Desktop/AntigravityWork/SECRETARY BUDDY',
            chatwork_rooms: [16392435], // マイチャット
        }
    },
    {
        id: 'proj:art-buddy',
        type: 'project',
        label: 'Art Buddy',
        status: 'active',
        sources: {
            github: 'RYKNSH/ART_BUDDY',
        }
    },
    {
        id: 'proj:discord-buddy',
        type: 'project',
        label: 'Discord Buddy',
        status: 'active',
        sources: {
            github: 'RYKNSH/DiscordBuddy',
        }
    },
    {
        id: 'proj:antigravity-core',
        type: 'project',
        label: 'Antigravity Core',
        status: 'active',
        sources: {
            github: 'RYKNSH/antigravity-core',
            local: '~/.antigravity',
        }
    },
    {
        id: 'proj:antigravity-private',
        type: 'project',
        label: 'Antigravity Private',
        status: 'active',
        sources: {
            github: 'RYKNSH/antigravity-private',
            local: '~/.antigravity-private',
        }
    },
    {
        id: 'proj:antigravity-controller',
        type: 'project',
        label: 'Antigravity Controller',
        status: 'active',
        sources: {
            github: 'RYKNSH/Antigravity-Controller',
        }
    },
    {
        id: 'proj:artistory-academy',
        type: 'project',
        label: 'ARTISTORY Academy',
        status: 'active',
        sources: {
            github: 'RYKNSH/artistory-academy',
        }
    },
    {
        id: 'proj:kpi-buddy',
        type: 'project',
        label: 'KPI Buddy',
        status: 'active',
        sources: {
            github: 'RYKNSH/kpi-buddy',
        }
    },
    {
        id: 'proj:zen-ai',
        type: 'project',
        label: 'Zen AI',
        status: 'paused',
        sources: {
            github: 'RYKNSH/zen-ai',
        }
    },
    {
        id: 'proj:videdit',
        type: 'project',
        label: 'Videdit Pipeline',
        status: 'paused',
        sources: {
            github: 'RYKNSH/Videdit_pipeline',
        }
    },
    {
        id: 'proj:mother-agent',
        type: 'project',
        label: 'Mother Agent',
        status: 'archived',
        sources: {
            github: 'RYKNSH/Mother-Agent',
        }
    },
    {
        id: 'proj:ryknsh-records',
        type: 'project',
        label: 'RYKNSH Records',
        status: 'active',
        sources: {
            github: 'RYKNSH/RYKNSH-records',
        }
    },
    {
        id: 'proj:soloprostudio',
        type: 'project',
        label: 'SoloProStudio',
        status: 'paused',
        sources: {
            github: 'RYKNSH/SoloProStudio',
        }
    },
    {
        id: 'proj:type-motion',
        type: 'project',
        label: 'Type Motion',
        status: 'paused',
        sources: {
            github: 'RYKNSH/type-motion',
        }
    },
    {
        id: 'proj:l-buddy',
        type: 'project',
        label: 'L-Buddy (LINE Bot)',
        status: 'paused',
        sources: {
            github: 'RYKNSH/l-buddy',
        }
    },
    {
        id: 'proj:discord-bot-stephen',
        type: 'project',
        label: 'Discord Bot Stephen',
        status: 'archived',
        sources: {
            github: 'RYKNSH/Discord-Bot-Stephen',
        }
    },
];

// GitHub repos as nodes
const REPOS = PROJECTS.map(p => ({
    id: `repo:${p.sources.github}`,
    type: 'repo',
    label: `${p.label} (GitHub)`,
    url: `https://github.com/${p.sources.github}`,
}));

// Key Chatwork rooms (business-relevant groups only, not direct messages)
const CHATWORK_ROOMS = [
    { id: 'cw:413850110', type: 'room', label: '全体_小西流 AI×音楽 PJ_S2C' },
    { id: 'cw:420889031', type: 'room', label: 'SP全体_小西流AI×音楽 PJ_S2C' },
    { id: 'cw:415372223', type: 'room', label: '【動画共同編集】ARTISTORY AI PROJECT' },
    { id: 'cw:413574974', type: 'room', label: '【デザイン】ARTISTORY AI PROJECT' },
    { id: 'cw:415356796', type: 'room', label: '【動画】ARTISTORY AI PROJECT' },
    { id: 'cw:409948274', type: 'room', label: 'teamふぃす' },
    { id: 'cw:409121886', type: 'room', label: '小西さんPJ × Misfits' },
    { id: 'cw:409948243', type: 'room', label: 'ART JOURNEY PROJECT' },
    { id: 'cw:374989559', type: 'room', label: '【プレダイ】シェア・アウトプット' },
    { id: 'cw:394772565', type: 'room', label: '【プレダイ】IT&AIヘルプデスク' },
    { id: 'cw:352827563', type: 'room', label: '【プレダイ】全体連絡(受信専用)' },
    { id: 'cw:407052454', type: 'room', label: '【JPRO】エリートクラスMMG（3期）' },
    { id: 'cw:407053188', type: 'room', label: '【JPRO】特待生MMG（5期）' },
];

// Infrastructure nodes
const INFRA = [
    { id: 'infra:antigravity', type: 'component', label: 'Antigravity Dev Environment', path: '~/.antigravity' },
    { id: 'infra:mcp-bus', type: 'component', label: 'MCP Bus (5 servers)', services: ['chatwork', 'discord', 'github', 'google-workspace'] },
    { id: 'infra:supabase', type: 'database', label: 'Supabase (shared DB)' },
    { id: 'infra:gdrive', type: 'folder', label: 'Google Drive (435GB)' },
];

// ============================================================
// EDGES: Known relationships
// ============================================================

const EDGES = [
    // Project → Repo
    ...PROJECTS.map(p => ({
        from: p.id,
        to: `repo:${p.sources.github}`,
        relation: 'implements',
    })),

    // Shared infrastructure
    { from: 'proj:secretary-buddy', to: 'infra:supabase', relation: 'depends_on', evidence: 'Supabase DB for user data + metrics' },
    { from: 'proj:artistory-academy', to: 'infra:supabase', relation: 'depends_on', evidence: 'Shared Supabase instance' },
    { from: 'proj:kpi-buddy', to: 'infra:supabase', relation: 'depends_on', evidence: 'KPI metrics storage' },

    // Antigravity relationships  
    { from: 'proj:antigravity-core', to: 'proj:antigravity-private', relation: 'depends_on', evidence: '.env secrets symlinked' },
    { from: 'proj:antigravity-controller', to: 'proj:antigravity-core', relation: 'depends_on', evidence: 'Discord control of antigravity' },
    { from: 'proj:secretary-buddy', to: 'proj:antigravity-core', relation: 'depends_on', evidence: 'Uses antigravity workflows' },

    // Buddy ecosystem
    { from: 'proj:discord-buddy', to: 'proj:secretary-buddy', relation: 'shared_infra', evidence: 'Same Discord bot ecosystem' },
    { from: 'proj:art-buddy', to: 'proj:secretary-buddy', relation: 'shared_infra', evidence: 'ACE infrastructure shared' },
    { from: 'proj:l-buddy', to: 'proj:secretary-buddy', relation: 'shared_infra', evidence: 'LINE integration channel' },

    // Chatwork correlations
    { from: 'proj:artistory-academy', to: 'cw:415372223', relation: 'discussed_in' },
    { from: 'proj:artistory-academy', to: 'cw:413574974', relation: 'discussed_in' },
    { from: 'proj:artistory-academy', to: 'cw:415356796', relation: 'discussed_in' },
    { from: 'proj:artistory-academy', to: 'cw:409948243', relation: 'discussed_in' },

    // MCP Bus connections
    { from: 'infra:mcp-bus', to: 'proj:secretary-buddy', relation: 'shared_infra', evidence: 'SECRETARY BUDDY uses MCP Bus' },
];

// ============================================================
// CORRELATIONS: Detected relationships
// ============================================================

const CORRELATIONS = [
    {
        entities: ['proj:secretary-buddy', 'proj:discord-buddy', 'proj:art-buddy', 'proj:l-buddy'],
        type: 'buddy_ecosystem',
        detected_by: 'L1:name_match',
        confidence: 0.95,
        evidence: 'All share "-buddy" naming convention and SECRETARY BUDDY as hub',
    },
    {
        entities: ['proj:antigravity-core', 'proj:antigravity-private', 'proj:antigravity-controller'],
        type: 'infra_stack',
        detected_by: 'L1:name_match',
        confidence: 0.95,
        evidence: 'All share "antigravity" naming convention',
    },
    {
        entities: ['cw:415372223', 'cw:413574974', 'cw:415356796'],
        type: 'content_mirror',
        detected_by: 'L1:name_match',
        confidence: 0.90,
        evidence: 'All contain "ARTISTORY AI PROJECT" in name',
    },
];

// ============================================================
// BOOTSTRAP EXECUTION
// ============================================================

function bootstrap() {
    console.log('🚀 DRG Bootstrap starting...\n');

    // Read current DRG
    let data = drg.readDRG(true); // Create backup first
    if (!data) {
        console.error('Failed to read DRG. Aborting.');
        process.exit(1);
    }

    // Add project nodes
    console.log('📦 Adding project nodes...');
    for (const p of PROJECTS) {
        try {
            drg.addNode(data, p);
            console.log(`  ✅ ${p.id} (${p.label})`);
        } catch (e) {
            console.log(`  ⏭️  ${p.id} — ${e.message}`);
        }
    }

    // Add repo nodes
    console.log('\n📂 Adding repo nodes...');
    for (const r of REPOS) {
        try {
            drg.addNode(data, r);
            console.log(`  ✅ ${r.id}`);
        } catch (e) {
            console.log(`  ⏭️  ${r.id} — ${e.message}`);
        }
    }

    // Add chatwork room nodes
    console.log('\n💬 Adding chatwork room nodes...');
    for (const c of CHATWORK_ROOMS) {
        try {
            drg.addNode(data, c);
            console.log(`  ✅ ${c.id} (${c.label})`);
        } catch (e) {
            console.log(`  ⏭️  ${c.id} — ${e.message}`);
        }
    }

    // Add infrastructure nodes
    console.log('\n🏗️  Adding infrastructure nodes...');
    for (const i of INFRA) {
        try {
            drg.addNode(data, i);
            console.log(`  ✅ ${i.id} (${i.label})`);
        } catch (e) {
            console.log(`  ⏭️  ${i.id} — ${e.message}`);
        }
    }

    // Add edges
    console.log('\n🔗 Adding edges...');
    for (const e of EDGES) {
        try {
            drg.addEdge(data, e);
        } catch (err) {
            console.log(`  ⏭️  ${e.from} → ${e.to} — ${err.message}`);
        }
    }
    console.log(`  ✅ ${EDGES.length} edges added`);

    // Add correlations
    console.log('\n🧠 Adding correlations...');
    data.correlations = CORRELATIONS;
    console.log(`  ✅ ${CORRELATIONS.length} correlations added`);

    // Write back
    console.log('\n💾 Writing DRG...');
    const success = drg.writeDRG(data);
    if (success) {
        console.log('✅ DRG Bootstrap complete!');
        console.log(`\n📊 Stats:`);
        console.log(`   Nodes: ${data.nodes.length}`);
        console.log(`   Edges: ${data.edges.length}`);
        console.log(`   Correlations: ${data.correlations.length}`);
    } else {
        console.error('❌ DRG write failed!');
        process.exit(1);
    }
}

bootstrap();
