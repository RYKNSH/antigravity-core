const fs = require('fs');
const path = require('path');

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const MR_FILE = path.join(ANTIGRAVITY_DIR, 'DECISION_USECASES.md');
const STATE_DIR = path.join(ANTIGRAVITY_DIR, 'state');
const ACTIVE_MRS_FILE = path.join(STATE_DIR, 'active_mrs.json');

function extractRequiredMRs() {
    if (!fs.existsSync(MR_FILE)) {
        console.warn(`[extract_mrs.js] Cannot find ${MR_FILE}`);
        return;
    }

    const content = fs.readFileSync(MR_FILE, 'utf-8');
    const requiredMRs = ['MR-08', 'MR-25']; // 常駐化必須MR
    
    // MR-xx (タイトル) を行単位で抽出
    const regex = /^### (MR-\d+):\s*(.*)$/gm;
    let match;
    const activeMRs = [];

    while ((match = regex.exec(content)) !== null) {
        const mrId = match[1];
        const title = match[2];
        
        if (requiredMRs.includes(mrId)) {
           // MRの詳細（次の###かファイルの末尾まで）を抽出
           const startIndex = content.indexOf(match[0]) + match[0].length;
           const nextMatchIndex = content.indexOf('### MR-', startIndex);
           const endIndex = nextMatchIndex !== -1 ? nextMatchIndex : content.length;
           
           const description = content.substring(startIndex, endIndex).trim();
           
           activeMRs.push({
               id: mrId,
               title: title,
               // 短く要約するか、詳細を含める
               description: description.substring(0, 200) + (description.length > 200 ? '...' : '') 
           });
        }
    }

    if (!fs.existsSync(STATE_DIR)) {
        fs.mkdirSync(STATE_DIR, { recursive: true });
    }

    fs.writeFileSync(ACTIVE_MRS_FILE, JSON.stringify({ active_mrs: activeMRs }, null, 2));
    console.log(`[extract_mrs.js] Successfully loaded MR-08, MR-25 into ${ACTIVE_MRS_FILE}`);
}

extractRequiredMRs();
