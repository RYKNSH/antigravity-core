#!/usr/bin/env node
/**
 * environment-check.js — Task 8.1.6
 * COO-Lite を呼び出す前に実行する環境健全性チェック。
 * 4つのチェックがすべて ok=true でなければ COO-Lite を起動せず issue 報告する。
 */

'use strict';

const { execSync } = require('child_process');
const fs    = require('fs');
const path  = require('path');
const https = require('https');

// ─── 定数 ───────────────────────────────────────────────────────────────────
const ANTIGRAVITY_DIR    = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const DECISION_USECASES  = path.join(ANTIGRAVITY_DIR, 'docs', 'DECISION_USECASES.md');
const API_ENDPOINT_HOST  = 'generativelanguage.googleapis.com';
const API_TIMEOUT_MS     = 5_000;

// ─── チェック実装 ────────────────────────────────────────────────────────────

/**
 * 1. Volume Mount Check
 * ANTIGRAVITY_DIR/docs/DECISION_USECASES.md が存在するか確認。
 * Docker Volume が正しくマウントされていれば必ず存在するはず。
 */
async function checkVolumeMount() {
  const exists = fs.existsSync(DECISION_USECASES);
  return {
    name   : 'volume_mount',
    ok     : exists,
    detail : exists
      ? `DECISION_USECASES.md found at ${DECISION_USECASES}`
      : `DECISION_USECASES.md NOT found. ANTIGRAVITY_DIR=${ANTIGRAVITY_DIR} may not be mounted correctly.`,
  };
}

/**
 * 2. Environment Variables Check
 * GEMINI_API_KEY と ANTIGRAVITY_DIR が設定されているか確認。
 */
async function checkEnvVariables() {
  const missing = [];
  if (!process.env.GEMINI_API_KEY)    missing.push('GEMINI_API_KEY');
  if (!process.env.ANTIGRAVITY_DIR)   missing.push('ANTIGRAVITY_DIR');

  const ok = missing.length === 0;
  return {
    name   : 'env_variables',
    ok,
    detail : ok
      ? 'GEMINI_API_KEY and ANTIGRAVITY_DIR are set.'
      : `Missing environment variables: ${missing.join(', ')}`,
  };
}

/**
 * 3. File Permissions Check
 * ANTIGRAVITY_DIR への書き込み権限があるか確認。
 */
async function checkFilePermissions() {
  const testFile = path.join(ANTIGRAVITY_DIR, '.permission_test_' + Date.now());
  try {
    fs.writeFileSync(testFile, 'ok', 'utf8');
    fs.unlinkSync(testFile);
    return {
      name  : 'file_permissions',
      ok    : true,
      detail: `Write permission confirmed on ${ANTIGRAVITY_DIR}`,
    };
  } catch (e) {
    return {
      name  : 'file_permissions',
      ok    : false,
      detail: `No write permission on ${ANTIGRAVITY_DIR}: ${e.message}`,
    };
  }
}

/**
 * 4. API Reachability Check
 * Gemini API エンドポイントへの HTTPS 疎通を 5 秒タイムアウトで確認。
 */
async function checkApiReachability() {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      req.destroy();
      resolve({
        name  : 'api_reachability',
        ok    : false,
        detail: `Timeout (${API_TIMEOUT_MS}ms) reaching ${API_ENDPOINT_HOST}`,
      });
    }, API_TIMEOUT_MS);

    const req = https.request(
      { hostname: API_ENDPOINT_HOST, path: '/', method: 'HEAD', timeout: API_TIMEOUT_MS },
      (res) => {
        clearTimeout(timer);
        // 200 or 404 etc. はいずれも「到達できた」と判断する
        resolve({
          name  : 'api_reachability',
          ok    : true,
          detail: `${API_ENDPOINT_HOST} reachable (HTTP ${res.statusCode})`,
        });
      }
    );
    req.on('error', (e) => {
      clearTimeout(timer);
      resolve({
        name  : 'api_reachability',
        ok    : false,
        detail: `Cannot reach ${API_ENDPOINT_HOST}: ${e.message}`,
      });
    });
    req.end();
  });
}

// ─── メイン API ──────────────────────────────────────────────────────────────

/**
 * run() — 4チェックを順次実行し、結果オブジェクトを返す。
 * @returns {Promise<{passed: boolean, results: object[]}>}
 */
async function run() {
  const checks = await Promise.all([
    checkVolumeMount(),
    checkEnvVariables(),
    checkFilePermissions(),
    checkApiReachability(),
  ]);

  const passed = checks.every((c) => c.ok);
  return { passed, results: checks };
}

module.exports = { run };

// ─── CLI 実行 ─────────────────────────────────────────────────────────────
if (require.main === module) {
  run().then(({ passed, results }) => {
    console.log('Environment Check Results:');
    results.forEach((r) => {
      console.log(`  ${r.ok ? '✅' : '❌'} [${r.name}] ${r.detail}`);
    });
    console.log(`\n  Overall: ${passed ? '✅ ALL PASSED — COO-Lite can be invoked.' : '❌ FAILED — COO-Lite will NOT be invoked.'}`);
    process.exit(passed ? 0 : 1);
  }).catch((e) => { console.error(e); process.exit(1); });
}
