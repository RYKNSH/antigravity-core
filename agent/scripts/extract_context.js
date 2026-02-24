#!/usr/bin/env node

/**
 * コンテキスト抽出スクリプト
 * セッションデータから重要情報を抽出・圧縮
 */

const fs = require('fs');
const path = require('path');

// Social Knowledge Score計算
const calculateSocialScore = (sessionData) => {
  let score = 0;

  // 変更行数
  if (sessionData.git.linesChanged > 100) score += 3;
  if (sessionData.git.linesChanged > 300) score += 2;

  // 新規ファイル数
  const newFiles = sessionData.git.filesList.filter(f => f.startsWith('A')).length;
  if (newFiles > 3) score += 3;

  // コミット数
  if (sessionData.git.commits > 5) score += 2;

  // アーティファクト数
  if (sessionData.artifacts.length > 5) score += 2;

  return score;
};

// タイトル抽出
const extractTitle = (sessionData) => {
  // 最新のコミットメッセージから抽出
  const latestCommit = sessionData.git.commitMessages[0] || '';

  // "feat: " などのプレフィックスを削除
  const title = latestCommit.replace(/^(feat|fix|docs|style|refactor|test|chore):\s*/i, '');

  return title || 'セッションサマリー';
};

// キーポイント抽出
const extractKeyPoints = (sessionData) => {
  const points = [];

  // コミットメッセージから抽出
  sessionData.git.commitMessages.forEach(msg => {
    const cleaned = msg.replace(/^(feat|fix|docs|style|refactor|test|chore):\s*/i, '');
    if (cleaned.length > 10) {
      points.push(cleaned);
    }
  });

  // アーティファクト名から抽出
  sessionData.artifacts.forEach(artifact => {
    const name = artifact.name.replace(/\.md$/, '').replace(/_/g, ' ');
    if (name.length > 5) {
      points.push(name);
    }
  });

  // 重複削除、上位5つ
  return [...new Set(points)].slice(0, 5);
};

// Pending Tasks抽出
const extractPendingTasks = (sessionData) => {
  const tasks = [];

  // Social Score >= 5 ならブログタスク追加
  const score = calculateSocialScore(sessionData);
  if (score >= 5) {
    tasks.push({
      task: 'blog',
      reason: `Social Knowledge Score: ${score}`,
      context_preserved: true,
      source_artifacts: sessionData.artifacts.map(a => a.path)
    });
  }

  return tasks;
};

// メイン処理
const main = () => {
  // 標準入力からセッションデータを読み取り
  let inputData = '';

  process.stdin.on('data', chunk => {
    inputData += chunk;
  });

  process.stdin.on('end', () => {
    const sessionData = JSON.parse(inputData);

    const compressedContext = {
      session_id: sessionData.session_id,
      timestamp: sessionData.timestamp,
      compressed_context: {
        blog_candidate: {
          score: calculateSocialScore(sessionData),
          title: extractTitle(sessionData),
          key_points: extractKeyPoints(sessionData),
          source_artifacts: sessionData.artifacts.map(a => a.path)
        },
        pending_tasks: extractPendingTasks(sessionData),
        stats: {
          commits: sessionData.git.commits,
          files_changed: sessionData.git.filesChanged,
          lines_changed: sessionData.git.linesChanged,
          artifacts: sessionData.artifacts.length
        }
      }
    };

    console.log(JSON.stringify(compressedContext, null, 2));
  });
};

main();
