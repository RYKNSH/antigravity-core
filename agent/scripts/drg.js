#!/usr/bin/env node
/**
 * DRG (Data Relationship Graph) Utility
 * 
 * Guards implemented:
 *   G1.1: Atomic write (tmp → rename)
 *   G1.2: JSON.parse validation
 *   G1.3: Schema validation (required fields)
 *   G1.7: Session backup on read
 *   G8.2: PII check (no personal names, only IDs)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const DRG_PATH = path.join(os.homedir(), '.antigravity', 'data_graph.json');
const BACKUP_PATH = path.join(os.homedir(), '.antigravity', 'data_graph.backup.json');

// --- G1.3: Schema Validation ---
const REQUIRED_META_FIELDS = ['version', 'schema_version', 'last_synced'];
const REQUIRED_NODE_FIELDS = ['id', 'type', 'label'];
const VALID_NODE_TYPES = ['project', 'component', 'asset', 'channel', 'repo', 'folder', 'page', 'room', 'database'];
const VALID_EDGE_RELATIONS = [
    'implements', 'documented_in', 'assets_in', 'discussed_in',
    'notified_to', 'references', 'shared_infra', 'depends_on',
    'parent_of', 'child_of', 'mirrors', 'archives'
];

// --- G8.2: PII Detection Patterns ---
const PII_PATTERNS = [
    /[\w.+-]+@[\w-]+\.[\w.]+/g,           // Email
    /\d{3}[-.]?\d{4}[-.]?\d{4}/g,         // Phone (JP)
    /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g // IP Address
];

function validateSchema(data) {
    const errors = [];

    // Meta validation
    if (!data._meta || typeof data._meta !== 'object') {
        errors.push('Missing or invalid _meta object');
    } else {
        for (const field of REQUIRED_META_FIELDS) {
            if (!(field in data._meta)) {
                errors.push(`Missing required _meta field: ${field}`);
            }
        }
    }

    // Nodes validation
    if (!Array.isArray(data.nodes)) {
        errors.push('nodes must be an array');
    } else {
        data.nodes.forEach((node, i) => {
            for (const field of REQUIRED_NODE_FIELDS) {
                if (!(field in node)) {
                    errors.push(`Node[${i}]: missing required field "${field}"`);
                }
            }
            if (node.type && !VALID_NODE_TYPES.includes(node.type)) {
                errors.push(`Node[${i}]: invalid type "${node.type}". Valid: ${VALID_NODE_TYPES.join(', ')}`);
            }
        });
    }

    // Edges validation
    if (!Array.isArray(data.edges)) {
        errors.push('edges must be an array');
    } else {
        const nodeIds = new Set((data.nodes || []).map(n => n.id));
        data.edges.forEach((edge, i) => {
            if (!edge.from) errors.push(`Edge[${i}]: missing "from"`);
            if (!edge.to) errors.push(`Edge[${i}]: missing "to"`);
            if (!edge.relation) errors.push(`Edge[${i}]: missing "relation"`);
            // G1.4: Dangling reference check
            if (edge.from && !nodeIds.has(edge.from)) {
                errors.push(`Edge[${i}]: dangling reference — "from" node "${edge.from}" does not exist`);
            }
            if (edge.to && !nodeIds.has(edge.to)) {
                errors.push(`Edge[${i}]: dangling reference — "to" node "${edge.to}" does not exist`);
            }
        });
    }

    // Correlations validation
    if (!Array.isArray(data.correlations)) {
        errors.push('correlations must be an array');
    }

    return errors;
}

// --- G8.2: PII Check ---
function checkPII(data) {
    const warnings = [];
    const jsonStr = JSON.stringify(data);

    for (const pattern of PII_PATTERNS) {
        const matches = jsonStr.match(pattern);
        if (matches) {
            warnings.push(`PII detected: ${matches.length} match(es) for pattern ${pattern.source}`);
        }
    }

    // Check for common PII field names in node labels/sources
    if (data.nodes) {
        data.nodes.forEach((node, i) => {
            if (node.label && node.label.length > 50) {
                warnings.push(`Node[${i}]: label is suspiciously long (${node.label.length} chars) — may contain PII`);
            }
        });
    }

    return warnings;
}

// --- G1.2: Safe Read with JSON.parse validation ---
function readDRG(createBackup = true) {
    if (!fs.existsSync(DRG_PATH)) {
        console.error(`[DRG] File not found: ${DRG_PATH}`);
        return null;
    }

    let rawData;
    try {
        rawData = fs.readFileSync(DRG_PATH, 'utf-8');
    } catch (err) {
        console.error(`[DRG] Read error: ${err.message}`);
        return null;
    }

    // G1.2: JSON.parse validation
    let data;
    try {
        data = JSON.parse(rawData);
    } catch (err) {
        console.error(`[DRG] G1.2 VIOLATION — JSON parse error: ${err.message}`);
        console.error('[DRG] Attempting recovery from backup...');
        if (fs.existsSync(BACKUP_PATH)) {
            try {
                data = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf-8'));
                console.log('[DRG] Recovered from backup successfully');
            } catch {
                console.error('[DRG] Backup also corrupt. Manual recovery required.');
                return null;
            }
        }
        return null;
    }

    // G1.3: Schema validation
    const schemaErrors = validateSchema(data);
    if (schemaErrors.length > 0) {
        console.error(`[DRG] G1.3 VIOLATION — Schema errors:`);
        schemaErrors.forEach(e => console.error(`  - ${e}`));
        // Non-fatal: return data but warn
    }

    // G8.2: PII check
    const piiWarnings = checkPII(data);
    if (piiWarnings.length > 0) {
        console.warn(`[DRG] G8.2 WARNING — PII detected:`);
        piiWarnings.forEach(w => console.warn(`  - ${w}`));
    }

    // G1.7: Create backup on read (session start)
    if (createBackup) {
        try {
            fs.copyFileSync(DRG_PATH, BACKUP_PATH);
        } catch (err) {
            console.warn(`[DRG] Backup creation failed: ${err.message}`);
        }
    }

    return data;
}

// --- G1.1: Atomic Write (tmp → rename) ---
function writeDRG(data) {
    // G1.3: Validate before writing
    const schemaErrors = validateSchema(data);
    if (schemaErrors.length > 0) {
        console.error(`[DRG] G1.3 VIOLATION — Refusing to write invalid data:`);
        schemaErrors.forEach(e => console.error(`  - ${e}`));
        return false;
    }

    // G8.2: PII check before writing
    const piiWarnings = checkPII(data);
    if (piiWarnings.length > 0) {
        console.error(`[DRG] G8.2 VIOLATION — PII detected, refusing to write:`);
        piiWarnings.forEach(w => console.error(`  - ${w}`));
        return false;
    }

    // Update metadata
    data._meta.last_synced = new Date().toISOString();
    data._meta.node_count = data.nodes.length;
    data._meta.edge_count = data.edges.length;

    // G1.1: Atomic write — write to tmp file, then rename
    const tmpPath = DRG_PATH + '.tmp.' + crypto.randomBytes(4).toString('hex');
    const jsonStr = JSON.stringify(data, null, 2) + '\n';

    try {
        fs.writeFileSync(tmpPath, jsonStr, 'utf-8');

        // Verify the tmp file is valid JSON before renaming
        JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));

        // Atomic rename
        fs.renameSync(tmpPath, DRG_PATH);
        return true;
    } catch (err) {
        console.error(`[DRG] G1.1 — Atomic write failed: ${err.message}`);
        // Cleanup tmp file
        try { fs.unlinkSync(tmpPath); } catch { }
        return false;
    }
}

// --- Node Operations ---
function addNode(data, node) {
    if (!node.id || !node.type || !node.label) {
        throw new Error('Node requires id, type, and label');
    }
    if (data.nodes.find(n => n.id === node.id)) {
        throw new Error(`Node with id "${node.id}" already exists`);
    }
    node.created_at = node.created_at || new Date().toISOString();
    node.updated_at = new Date().toISOString();
    data.nodes.push(node);
    return data;
}

function addEdge(data, edge) {
    if (!edge.from || !edge.to || !edge.relation) {
        throw new Error('Edge requires from, to, and relation');
    }
    edge.created_at = edge.created_at || new Date().toISOString();
    data.edges.push(edge);
    return data;
}

function findNode(data, id) {
    return data.nodes.find(n => n.id === id) || null;
}

function findEdgesFrom(data, nodeId) {
    return data.edges.filter(e => e.from === nodeId);
}

function findEdgesTo(data, nodeId) {
    return data.edges.filter(e => e.to === nodeId);
}

function removeNode(data, nodeId) {
    data.nodes = data.nodes.filter(n => n.id !== nodeId);
    data.edges = data.edges.filter(e => e.from !== nodeId && e.to !== nodeId);
    return data;
}

// --- CLI Interface ---
function main() {
    const args = process.argv.slice(2);
    const cmd = args[0];

    switch (cmd) {
        case 'read':
        case 'validate': {
            const data = readDRG(cmd === 'read');
            if (!data) {
                process.exit(1);
            }
            const errors = validateSchema(data);
            const pii = checkPII(data);
            console.log(JSON.stringify({
                valid: errors.length === 0,
                schema_errors: errors,
                pii_warnings: pii,
                stats: {
                    nodes: data.nodes.length,
                    edges: data.edges.length,
                    correlations: data.correlations.length,
                    last_synced: data._meta.last_synced
                }
            }, null, 2));
            break;
        }

        case 'add-node': {
            const data = readDRG(false);
            if (!data) process.exit(1);
            const nodeJson = args[1];
            if (!nodeJson) {
                console.error('Usage: drg.js add-node \'{"id":"...","type":"...","label":"..."}\'');
                process.exit(1);
            }
            try {
                const node = JSON.parse(nodeJson);
                addNode(data, node);
                if (writeDRG(data)) {
                    console.log(`Added node: ${node.id}`);
                } else {
                    process.exit(1);
                }
            } catch (err) {
                console.error(`Error: ${err.message}`);
                process.exit(1);
            }
            break;
        }

        case 'add-edge': {
            const data = readDRG(false);
            if (!data) process.exit(1);
            const edgeJson = args[1];
            if (!edgeJson) {
                console.error('Usage: drg.js add-edge \'{"from":"...","to":"...","relation":"..."}\'');
                process.exit(1);
            }
            try {
                const edge = JSON.parse(edgeJson);
                addEdge(data, edge);
                if (writeDRG(data)) {
                    console.log(`Added edge: ${edge.from} → ${edge.to} (${edge.relation})`);
                } else {
                    process.exit(1);
                }
            } catch (err) {
                console.error(`Error: ${err.message}`);
                process.exit(1);
            }
            break;
        }

        case 'stats': {
            const data = readDRG(false);
            if (!data) process.exit(1);
            const types = {};
            data.nodes.forEach(n => { types[n.type] = (types[n.type] || 0) + 1; });
            console.log(JSON.stringify({
                total_nodes: data.nodes.length,
                total_edges: data.edges.length,
                total_correlations: data.correlations.length,
                node_types: types,
                last_synced: data._meta.last_synced,
                schema_version: data._meta.schema_version
            }, null, 2));
            break;
        }

        default:
            console.log('DRG Utility — Data Relationship Graph Manager');
            console.log('');
            console.log('Commands:');
            console.log('  validate          Validate DRG schema and check for PII');
            console.log('  read              Read DRG and create backup');
            console.log('  stats             Show DRG statistics');
            console.log('  add-node <json>   Add a node');
            console.log('  add-edge <json>   Add an edge');
            break;
    }
}

// Export for programmatic use
module.exports = { readDRG, writeDRG, validateSchema, checkPII, addNode, addEdge, findNode, findEdgesFrom, findEdgesTo, removeNode, DRG_PATH, BACKUP_PATH };

if (require.main === module) {
    main();
}
