---
description: Daemon Core CLIゲートウェイ。タスクをキューにPushしDaemonが自律実行する。ステータス確認・リスト表示・完了タスク削除にも対応。
---

# /core-run — Daemon Core CLI Gateway

// turbo-all

## 概要

`core-run.js` を通じて、Daemon Coreの `pending_tasks` キューにタスクをPushする。
Daemonが約3秒ごとにPollして自律実行する非同期ゲートウェイ。

```
スクリプト: ~/.antigravity/agent/scripts/core-run.js
状態ファイル: ~/.antigravity/.session_state.json
```

---

## 使い方

### タスクをPush（基本）
```bash
node ~/.antigravity/agent/scripts/core-run.js "タスク内容"
```

### タスクをPush（優先度・TTL指定）
```bash
node ~/.antigravity/agent/scripts/core-run.js "タスク内容" --priority high --ttl 600
# --priority: high | normal | self_improvement
# --ttl: 秒数（デフォルト 300）
```

### タスクをPush（Smart Contract付き）
```bash
node ~/.antigravity/agent/scripts/core-run.js "タスク内容" --contract '{"budget":{"max_llm_calls":50},"quality_gates":["lint_pass","tests_pass"]}'
```

### Daemonの状態を確認
```bash
node ~/.antigravity/agent/scripts/core-run.js --status
```

### Pendingキューを一覧表示
```bash
node ~/.antigravity/agent/scripts/core-run.js --list
```

### 完了タスクをクリア
```bash
node ~/.antigravity/agent/scripts/core-run.js --clear-completed
```

---

## AIエージェントとしての使い方

ユーザーから「Daemonにタスクを投げて」「バックグラウンドで実行して」と言われた場合:

1. タスク内容を確定する（曖昧なら `~/.antigravity/docs/TASKS.md` で直近タスクを参照）
2. 以下のコマンドで Push:
   ```bash
   node ~/.antigravity/agent/scripts/core-run.js "具体的なタスク文字列" --priority normal
   ```
3. `--status` で Push 確認
4. ユーザーに「Daemon Coreが受信した。次のPollサイクル（〜3秒）で実行開始」と報告

---

## 優先度の選択基準

| 優先度 | 使いどき |
|--------|---------|
| `high` | 今すぐやってほしいバグ修正・本番障害対応 |
| `normal` | 通常の機能開発・タスク実行 |
| `self_improvement` | Daemon自己進化・スキル向上タスク |

---

## 関連ワークフロー

- `/daemon-dev` — Daemon Core開発セッション
- `/core-dev` — Antigravity Core開発セッション
- `/core-ci-dev` — CI Pipeline開発セッション
- `/go` — IDE側の実装実行
