#!/usr/bin/env node

/**
 * セッションデータ収集スクリプト
 * /checkout Phase 0で実行
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// セッション開始時刻（環境変数から取得）
const SESSION_START = process.env.SESSION_START || Date.now() - 3600000; // デフォルト1時間前

// Git履歴収集
const collectGitHistory = () => {
  try {
    const commits = execSync('git log --oneline --since="6 hours ago"', { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(line => line)
      .map(line => {
        const [hash, ...message] = line.split(' ');
        return { hash, message: message.join(' ') };
      });

    const filesChanged = execSync(`git diff --name-only HEAD~${commits.length}`, { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(line => line);

    const diffStat = execSync(`git diff --stat HEAD~${commits.length}`, { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .pop();

    const linesChanged = (diffStat.match(/\d+/g) || []).reduce((sum, n) => sum + parseInt(n), 0);

    return {
      commits: commits.length,
      commitMessages: commits.map(c => c.message),
      filesChanged: filesChanged.length,
      filesList: filesChanged,
      linesChanged
    };
  } catch (error) {
    console.error('Git履歴収集エラー:', error.message);
    return {
      commits: 0,
      commitMessages: [],
      filesChanged: 0,
      filesList: [],
      linesChanged: 0
    };
  }
};

// アーティファクト収集
const collectArtifacts = () => {
  const brainDir = path.join(process.env.HOME, '.gemini/antigravity/brain');
  const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);

  try {
    const artifacts = fs.readdirSync(brainDir, { recursive: true })
      .filter(file => file.endsWith('.md'))
      .map(file => path.join(brainDir, file))
      .filter(filePath => {
        const stats = fs.statSync(filePath);
        return stats.mtimeMs > sixHoursAgo;
      })
      .map(filePath => ({
        path: filePath,
        name: path.basename(filePath),
        size: fs.statSync(filePath).size,
        modified: fs.statSync(filePath).mtime
      }));

    return artifacts;
  } catch (error) {
    console.error('アーティファクト収集エラー:', error.message);
    return [];
  }
};

// メイン処理
const main = () => {
  const sessionData = {
    session_id: new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5),
    timestamp: new Date().toISOString(),
    duration: Math.floor((Date.now() - SESSION_START) / 1000),
    git: collectGitHistory(),
    artifacts: collectArtifacts()
  };

  // JSON出力
  console.log(JSON.stringify(sessionData, null, 2));
};

main();
