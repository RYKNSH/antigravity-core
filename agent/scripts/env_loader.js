/**
 * env_loader.js — Antigravity Core 統一環境変数ローダー
 * 
 * 全スクリプトからの機密取得を 1Password (op) 優先で統一する。
 *
 * 優先順位:
 *   1. 1Password CLI (op run) — 環境変数として自動注入
 *   2. プロジェクトの .env (checkin時に op inject で生成済み)
 *   3. ~/.antigravity/.env (フォールバック)
 * 
 * Usage:
 *   const { loadEnv, getSecret } = require('./env_loader');
 *   loadEnv();  // process.env にロード
 *   const key = getSecret('NOTION_API_KEY');  // 取得 or throw
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const AG_DIR = process.env.ANTIGRAVITY_DIR || path.join(os.homedir(), '.antigravity');

/**
 * .env ファイルをパースして process.env にロード（既存値は上書きしない）
 */
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+)/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["'](.*?)["']$/, '$1');
    }
  }
  return true;
}

/**
 * 1Password から直接取得を試みる
 * op read "op://Antigravity/<item>/<field>"
 */
function opRead(ref) {
  try {
    return execSync(`op read "${ref}" 2>/dev/null`, { timeout: 5000 })
      .toString().trim();
  } catch {
    return null;
  }
}

/**
 * 1Password CLI が利用可能かチェック
 */
function isOpAvailable() {
  try {
    execSync('op account list 2>/dev/null', { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * 環境変数をロード (1Password → .env 優先順位)
 * 
 * checkin 時に op inject で .env が生成されているはずなので、
 * 通常はファイル読み込みだけで十分。
 * .env がなければ op inject をその場で実行する。
 */
function loadEnv() {
  const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join(AG_DIR, '.env'),
  ];

  let loaded = false;
  for (const p of envPaths) {
    if (parseEnvFile(p)) {
      loaded = true;
      break;
    }
  }

  // .env がどこにもなければ、op inject で生成を試みる
  if (!loaded && isOpAvailable()) {
    const tpl = path.join(AG_DIR, '.env.shared.tpl');
    if (fs.existsSync(tpl)) {
      try {
        const envContent = execSync(
          `op inject -i "${tpl}" 2>/dev/null`,
          { timeout: 10000 }
        ).toString();
        // メモリ上にロード (.env ファイルは作成しない — セキュリティ)
        for (const line of envContent.split('\n')) {
          const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+)/);
          if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2].trim().replace(/^["'](.*?)["']$/, '$1');
          }
        }
        loaded = true;
      } catch { /* op inject failed — fall through */ }
    }
  }

  return loaded;
}

/**
 * 指定されたキーの機密を取得。
 * process.env → なければ op read で直接取得。
 */
function getSecret(key, opts = {}) {
  // 1. process.env (loadEnv() or 外部から注入済み)
  if (process.env[key]) return process.env[key];

  // 2. 1Password 直接取得 (opRef が指定されていれば)
  if (opts.opRef) {
    const val = opRead(opts.opRef);
    if (val) {
      process.env[key] = val; // cache
      return val;
    }
  }

  // 3. required ならエラー
  if (opts.required !== false) {
    throw new Error(
      `❌ Secret "${key}" not found. Run checkin or: op inject -i ~/.antigravity/.env.shared.tpl -o .env`
    );
  }
  return null;
}

module.exports = { loadEnv, getSecret, isOpAvailable, opRead };
