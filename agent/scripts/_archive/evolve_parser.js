const fs = require('fs');
const path = require('path');

function parsePatterns(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const patterns = [];
    let currentPattern = null;

    for (const line of lines) {
        if (line.match(/^### (([A-Z]+-\d+):.*|.*原理.*)/)) {
            if (currentPattern) patterns.push(currentPattern);
            currentPattern = { name: line.replace(/^### /, '').trim(), hits: 0, uses: 0, status: 'active' };
        } else if (currentPattern) {
            const hitMatch = line.match(/\*ヒット率\*.*:\s*(\d+)\s*\/\s*(\d+)/) || line.match(/ヒット率:\s*(\d+)\/(\d+)/);
            if (hitMatch) {
                currentPattern.hits = parseInt(hitMatch[1], 10);
                currentPattern.uses = parseInt(hitMatch[2], 10);
            }
            const statusMatch = line.match(/\*ステータス\*.*:\s*(.*)/) || line.match(/ステータス:\s*(.*)/);
            if (statusMatch) {
               currentPattern.status = statusMatch[1].trim();
            }
        }
    }
    if (currentPattern) patterns.push(currentPattern);
    return patterns;
}

function analyzePatterns(patterns, type) {
    const suggestions = [];
    patterns.forEach(p => {
        if (p.status.includes('deprecated') || p.status.includes('archived')) return;
        if (p.uses > 5) {
            const rate = p.hits / p.uses;
            if (rate < 0.2) {
                suggestions.push(`🧹 [${type}] Low hit rate for rule '${p.name}' (${p.hits}/${p.uses} = ${(rate*100).toFixed(0)}%). Consider marking as deprecated.`);
            }
        }
    });
    return suggestions;
}

module.exports = { parsePatterns, analyzePatterns };
