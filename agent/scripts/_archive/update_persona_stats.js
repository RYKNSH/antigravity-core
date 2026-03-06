const fs = require('fs');
const path = require('path');
// js-yaml dependency removed to avoid module errors. Regex used for updates.
// Let's check if js-yaml is available. If not, we might need a simple parser or install it. 
// Given the environment, it's safer to use a regex-based approach for simple frontmatter updates 
// or check if `js-yaml` is in node_modules. 
// However, to be robust and dependency-free, I will implement a robust frontmatter parser/stringifier.

const PERSONAS_DIR = path.join(__dirname, '../skills/persona-orchestration/personas');

function parseArgs() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: node update_persona_stats.js <json_payload_string_or_file>');
        process.exit(1);
    }
    const input = args[0];
    try {
        if (fs.existsSync(input)) {
            return JSON.parse(fs.readFileSync(input, 'utf8'));
        }
        return JSON.parse(input);
    } catch (e) {
        console.error('Error parsing JSON payload:', e);
        process.exit(1);
    }
}

function findPersonaFile(name) {
    const ranks = ['core', 'regular', 'intern', 'graveyard'];
    for (const rank of ranks) {
        const filePath = path.join(PERSONAS_DIR, rank, `${name.toLowerCase().replace(/ /g, '_')}.md`);
        if (fs.existsSync(filePath)) {
            return { filePath, rank };
        }
    }
    return null;
}

function updateFrontmatter(content, stats) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    
    if (!match) return content; // No frontmatter found

    let frontmatter = match[1];
    
    // Helper to update a field in YAML-like string
    const updateField = (key, value) => {
        const regex = new RegExp(`^${key}:.*$`, 'm');
        if (regex.test(frontmatter)) {
            frontmatter = frontmatter.replace(regex, `${key}: ${value}`);
        } else {
            frontmatter += `\n${key}: ${value}`;
        }
    };

    updateField('sessions', stats.sessions);
    updateField('last_active', stats.last_active);
    updateField('adopted', stats.adopted);
    updateField('rejected', stats.rejected);
    updateField('impact_score', stats.impact_score);

    // Rank update logic handled outside or just updated here if changed
    if (stats.rank) {
         updateField('rank', stats.rank);
    }

    return content.replace(frontmatterRegex, `---\n${frontmatter}\n---`);
}

function appendGrowthLog(content, logEntry) {
    const growthLogHeader = '# Growth Log';
    const index = content.indexOf(growthLogHeader);
    
    const today = new Date().toISOString().split('T')[0];
    const newEntry = `
- ${today}: 
  - ${logEntry.summary}
  - Impact: ${logEntry.impact_delta > 0 ? '+' : ''}${logEntry.impact_delta}
`;

    if (index !== -1) {
        // Append after the header
        // Find the next section or end of file
        return content + newEntry; 
        // Ideally we insert right after the header, but appending to end is safer for now if structure is loose.
        // Actually, let's look for the header and append after it.
    } else {
        return content + `\n\n${growthLogHeader}\n${newEntry}`;
    }
}

function calculateRank(currentRank, stats) {
    if (currentRank === 'intern' && stats.adopted >= 5) return 'regular';
    if (currentRank === 'regular' && stats.adopted >= 15 && stats.impact_score >= 50) return 'core';
    return currentRank; // No change
}

function moveFile(oldPath, newRank, filename) {
    const newPath = path.join(PERSONAS_DIR, newRank, filename);
    const newDir = path.dirname(newPath);
    if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
    
    fs.renameSync(oldPath, newPath);
    return newPath;
}

function main() {
    const payload = parseArgs();
    // Payload schema:
    // {
    //   "personas": [
    //     { "name": "Skeptic", "adopted": 1, "rejected": 0, "impact_delta": 5, "summary": "Identified security flaw." }
    //   ]
    // }

    if (!payload.personas || !Array.isArray(payload.personas)) {
        console.error('Invalid payload: missing "personas" array.');
        process.exit(1);
    }

    console.log(`Processing stats for ${payload.personas.length} personas...`);

    payload.personas.forEach(p => {
        const found = findPersonaFile(p.name);
        
        if (!found) {
            console.log(`[New Persona] ${p.name} (Ad-hoc) - Consider recruiting explicitly to create intern file.`);
            return; 
            // Future: Auto-create intern file if impact is high enough?
            // For now, we only update existing files.
        }

        let { filePath, rank } = found;
        let content = fs.readFileSync(filePath, 'utf8');

        // Parse current stats
        const sessionsMatch = content.match(/sessions:\s*(\d+)/);
        const adoptedMatch = content.match(/adopted:\s*(\d+)/);
        const rejectedMatch = content.match(/rejected:\s*(\d+)/);
        const impactMatch = content.match(/impact_score:\s*(-?\d+)/);

        let stats = {
            sessions: parseInt(sessionsMatch ? sessionsMatch[1] : 0) + 1,
            adopted: parseInt(adoptedMatch ? adoptedMatch[1] : 0) + (p.adopted || 0),
            rejected: parseInt(rejectedMatch ? rejectedMatch[1] : 0) + (p.rejected || 0),
            impact_score: parseInt(impactMatch ? impactMatch[1] : 0) + (p.impact_delta || 0),
            last_active: new Date().toISOString().split('T')[0]
        };

        // Check for promotion
        const newRank = calculateRank(rank, stats);
        if (newRank !== rank) {
            console.log(`🎉 PROMOTION: ${p.name} promoted from ${rank} to ${newRank}!`);
            stats.rank = newRank;
            // Move file
            filePath = moveFile(filePath, newRank, path.basename(filePath));
        }

        content = updateFrontmatter(content, stats);
        content = appendGrowthLog(content, { summary: p.summary, impact_delta: p.impact_delta });

        fs.writeFileSync(filePath, content);
        console.log(`Updated ${p.name}: Impact ${stats.impact_score} (Delta: ${p.impact_delta})`);
    });
}

main();
