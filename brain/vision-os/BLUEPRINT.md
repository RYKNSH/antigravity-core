# BLUEPRINT.md — The Immortal SSD (Optimized)

> 🚀 Drafted by Elon — "Delete the part. The best part is no part."

---

## Core Logic (The Algorithm)

**全体を4つのコンポーネントに削減。** それ以上は不要。

```
┌─────────────────────────────────────────────┐
│  Component 1: BOOTSTRAP                     │
│  (SSD接続 → 自動セットアップ)               │
│                                             │
│  Component 2: HEARTBEAT                     │
│  (タスクキュー監視 + 実行ループ)             │
│                                             │
│  Component 3: QUALITY GATE                  │
│  (ゼロエラー検証 + 問題分解)                 │
│                                             │
│  Component 4: NOTIFIER                      │
│  (Discord通知 + 承認ゲート)                  │
└─────────────────────────────────────────────┘
```

---

## Component 1: BOOTSTRAP

**目的**: SSD接続→1コマンドで全自動セットアップ。

### ファイル構成
```
SSD/.antigravity/
├── setup.sh                    # [NEW] エントリポイント
├── heartbeat/                  # [NEW] 全コンポーネント格納
│   ├── heartbeat.js            # [NEW] メインループ
│   ├── quality-gate.js         # [NEW] 検証エンジン
│   ├── notifier.js             # [NEW] Discord通知
│   ├── task-runner.js          # [NEW] LLM API + コマンド実行
│   ├── config.json             # [NEW] 設定（API上限、通知先等）
│   └── package.json            # [NEW] 依存管理
├── queue/                      # [NEW] タスクキュー
│   ├── pending/                # 未処理タスク
│   ├── running/                # 実行中
│   ├── completed/              # 完了
│   └── blocked/                # 承認待ち
└── brain/
    └── session_state.json      # [NEW] セッション状態
```

### setup.sh の処理
```bash
#!/bin/bash
# 1. Node.js 存在チェック（なければ案内）
# 2. npm install（heartbeat/package.json）
# 3. LaunchAgent plist を ~/Library/LaunchAgents/ にコピー
# 4. launchctl load
# 5. macOS Keychain にAPIキー登録（初回のみ対話）
# 6. "Ready. SSD is alive." 出力
```

### LaunchAgent plist
```xml
<!-- com.antigravity.heartbeat.plist -->
<plist>
  <dict>
    <key>Label</key>
    <string>com.antigravity.heartbeat</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/local/bin/node</string>
      <string>/Volumes/PortableSSD/.antigravity/heartbeat/heartbeat.js</string>
    </array>
    <key>StartInterval</key>
    <integer>30</integer> <!-- 30秒ごとにキューチェック -->
    <key>StandardOutPath</key>
    <string>/Volumes/PortableSSD/.antigravity/logs/heartbeat.log</string>
    <key>StandardErrorPath</key>
    <string>/Volumes/PortableSSD/.antigravity/logs/heartbeat.error.log</string>
  </dict>
</plist>
```

---

## Component 2: HEARTBEAT

**目的**: 30秒ごとに `queue/pending/` を監視、タスクを拾って実行。

### heartbeat.js のアルゴリズム
```javascript
// 擬似コード
async function heartbeat() {
  const tasks = fs.readdirSync('queue/pending/')
    .filter(f => f.endsWith('.md'))
    .sort(); // 番号順

  if (tasks.length === 0) return; // 何もなければ即終了

  const task = tasks[0]; // 1つずつ処理
  moveFile(task, 'queue/running/');

  const result = await taskRunner.execute(task); // Component 3,4を呼ぶ

  if (result.status === 'completed') {
    moveFile(task, 'queue/completed/');
    notifier.send('✅ タスク完了', result.summary);
  } else if (result.status === 'blocked') {
    moveFile(task, 'queue/blocked/');
    notifier.sendApproval('🔒 承認が必要', result.reason);
  }

  updateSessionState(result);
}
```

### task-runner.js: LLM API呼び出し
```javascript
async function execute(taskFile) {
  const taskContent = fs.readFileSync(taskFile, 'utf-8');
  const apiKey = await keychain.get('ANTHROPIC_API_KEY'); // Keychainから取得

  let iteration = 0;
  const MAX_ITERATIONS = 20; // コストガード
  const MAX_COST_USD = 5.0;  // 1タスクあたり$5上限
  let totalCost = 0;

  while (iteration < MAX_ITERATIONS && totalCost < MAX_COST_USD) {
    // 1. LLMにタスク + コンテキストを送信
    const response = await callLLM(taskContent, context);

    // 2. LLMのレスポンスからコマンドを抽出・実行
    const commands = parseCommands(response);
    const results = await executeCommands(commands);

    // 3. Quality Gate で検証
    const quality = await qualityGate.check(results);

    if (quality.allPassed) {
      return { status: 'completed', summary: quality.report };
    }

    // 4. 問題分解
    if (quality.errorType === 'design') {
      return { status: 'blocked', reason: quality.designQuestion };
    }

    // 5. trivial/logic エラー → LLMに再投入
    context = { ...context, errors: quality.errors };
    iteration++;
    totalCost += response.usage.cost;
  }

  // コストガード発動
  return { status: 'blocked', reason: `上限到達 (${iteration}回, $${totalCost})` };
}
```

---

## Component 3: QUALITY GATE

**目的**: ゼロエラー到達まで検証する。明らかなエラーを残さない。

### quality-gate.js
```javascript
async function check(projectPath) {
  const results = {
    lint: null,
    typeCheck: null,
    build: null,
    test: null,
    browserReview: null
  };

  // Phase 1: 静的解析（超高速、コスト0）
  results.lint = await run('npm run lint', projectPath);
  results.typeCheck = await run('npx tsc --noEmit', projectPath);

  // Phase 2: ビルド（Phase 1通過後のみ）
  if (results.lint.pass && results.typeCheck.pass) {
    results.build = await run('npm run build', projectPath);
  }

  // Phase 3: テスト（Phase 2通過後のみ）
  if (results.build?.pass) {
    results.test = await run('npm test', projectPath);
  }

  // Phase 4: ブラウザレビュー（Phase 3通過後のみ）
  // → dev server起動 → screenshot → LLMで自己評価
  if (results.test?.pass) {
    results.browserReview = await browserReview(projectPath);
  }

  // エラー分類
  const errors = Object.entries(results)
    .filter(([, v]) => v && !v.pass)
    .map(([k, v]) => classifyError(k, v));

  return {
    allPassed: errors.length === 0,
    errors,
    errorType: errors[0]?.type || null, // 'trivial' | 'logic' | 'design'
    report: generateReport(results)
  };
}

function classifyError(phase, result) {
  // Trivial: lint error, import missing, typo
  // Logic: test failure, wrong output
  // Design: architecture issue, missing feature spec
  if (phase === 'lint') return { type: 'trivial', ...result };
  if (phase === 'test') return { type: 'logic', ...result };
  if (result.stderr?.includes('design') || result.stderr?.includes('architecture'))
    return { type: 'design', ...result };
  return { type: 'logic', ...result };
}
```

---

## Component 4: NOTIFIER

**目的**: Discord経由で完了通知と承認リクエスト。

### notifier.js
```javascript
const WEBHOOK_URL = config.discord_webhook;

async function send(title, body) {
  await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title,
        description: body,
        color: 0x00ff88, // 緑
        timestamp: new Date().toISOString()
      }]
    })
  });
}

async function sendApproval(title, reason) {
  // Discord Interaction（Bot経由）で承認ボタン付きメッセージ
  // 簡易版: webhook + 手動承認ファイル
  await send(`🔒 ${title}`, `${reason}\n\n承認するには:\n\`echo "approved" > queue/blocked/<task>.approval\``);
}
```

---

## Infrastructure (The Metal)

| 項目 | 選択 | 理由 |
|------|------|------|
| **Runtime** | Node.js | SSD上に既存、スクリプト資産が全てJS |
| **LLM API** | Anthropic Claude | コード生成精度、cost-per-token最適 |
| **状態管理** | JSON files | SQLiteすら不要。ファイルシステムで十分 |
| **通知** | Discord Webhook | 既存インフラ、スマホ通知対応 |
| **秘密管理** | macOS Keychain | ゼロコスト、SSD紛失時安全 |
| **プロセス管理** | macOS LaunchAgent | ゼロ依存、OS標準 |
| **ログ** | ファイル + Discord | 複雑なログ基盤不要 |

## Cost Analysis

| 項目 | コスト |
|------|--------|
| **開発工数** | 4コンポーネント × 1ファイル = ~800行 |
| **依存パッケージ** | 0（Node.js標準 + fetch） |
| **API費用** | ~$5/タスク上限 × 推定5タスク/日 = $25/日 MAX |
| **インフラ費用** | $0（全てローカル） |

## 削除したもの (Elon's Cuts)

- ❌ `session_state.json` の複雑な構造 → `queue/` のファイル配置が状態そのもの
- ❌ Self-Healing の定期チェック → Heartbeatの起動時に1回だけ実行すれば十分
- ❌ セッション管理の抽象化 → 不要。タスクファイルが全て
- ❌ 複数LLM対応 → 1つに絞る。切り替えは将来の話

> 🚀 **"If a task file exists in pending/, it will be done. That's all there is to it."**
