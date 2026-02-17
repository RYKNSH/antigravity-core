---
description: セッション開始から作業まで全自動化する究極のメタワークフロー
---

# /go - 究極の1コマンド

> [!TIP]
> **これが唯一の必須コマンド**
> セッション開始 → 作業 → 終了まで、このコマンドだけで完結

> [!NOTE]
> **エージェント向け**: ルーティング判断は [`WORKFLOW_ROUTER.md`](file://WORKFLOW_ROUTER.md)、入出力契約は [`WORKFLOW_CONTRACTS.md`](file://WORKFLOW_CONTRACTS.md) を参照。
> セッション内状態は `.session_state` で永続化する（Phase開始/遷移/完了時に更新）。

---

## 使用方法

```
/go                          # セッション開始のみ
/go "タスク"                  # セッション開始 + タスク指定
/go --vision "ビジョン"       # セッション開始 + ビジョン駆動開発
```

---

## 自動実行プロセス

### Phase 1: セッション開始（自動）
// turbo

以下を自動実行:

0. **セッション状態の初期化/復元**
```bash
# 前回のstateが残っていれば読み込み（Compaction復元用）
STATE_SCRIPT="$ANTIGRAVITY_DIR/agent/scripts/session_state.js"
EXISTING=$(node "$STATE_SCRIPT" read 2>/dev/null)
if [ "$EXISTING" != "null" ] && [ -n "$EXISTING" ]; then
  echo "📋 前回セッション状態を復元:"
  node "$STATE_SCRIPT" summary
else
  node "$STATE_SCRIPT" init
fi
```

1. 環境クリーンアップ（`/checkin` 相当）
2. GitHub同期
3. 開発サーバー起動（`/dev` 相当）

```markdown
[🟢 セッション開始]
✅ セッション状態初期化/復元
✅ 環境チェック完了
✅ GitHub同期完了
✅ 開発サーバー起動
Ready!
```

---

### Phase 2: 作業モード

// turbo
**Phase遷移時にsession stateを更新:**
```bash
node $ANTIGRAVITY_DIR/agent/scripts/session_state.js set-workflow '/work' 'phase2_active'
```

#### A. 通常モード（自然言語）

タスクが指定された場合、または自然言語でタスクを受け取った場合:

```markdown
[🟢 作業中] User: ログイン機能にバグがある

→ 自動でタスク分析
→ /work 相当を実行
→ 完了後 /verify 相当を自動実行

[🔵 検証中] テスト実行中...
[🟢 作業中] ✅ 検証完了、問題なし
```

#### B. ビジョンモード (`--vision`)

`/go --vision "ビジョン"` で起動した場合:

```markdown
[🟣 ビジョン駆動] User: 完全自律AI駆動型開発環境

→ /vision-os を内部呼び出し
→ Jensen Interview → Steve Vision → Elon Blueprint
→ 実装 → Quality Gate → Knowledge Capture

[🔵 ディベート中] Titanチームが議論中...
[🟣 ビジョン駆動] ✅ ビジョン実現完了
```

**作業中は一切のコマンド不要**

---

### Phase 3: セッション終了（自然言語トリガー）

以下のフレーズで終了モードに移行:

| トリガー | 動作 |
|----------|------|
| 「終わり」「おしまい」 | 終了確認 |
| 「今日はここまで」 | 終了確認 |
| 「チェックアウト」 | 終了確認 |
| 「また明日」 | 終了確認 |

```markdown
[🟡 終了中]

📋 セッションサマリー
- 完了タスク: 2件
- 変更ファイル: 5件
- 未コミット変更: あり

デプロイしますか？ (y/N): n
コミットしますか？ (Y/n): y

[⚪ 終了] お疲れ様でした！
```

---

## 状態表示

常に現在状態を表示:

| 状態 | 表示 | 意味 |
|------|------|------|
| 🟢 | `[🟢 作業中]` | タスク実行可能 |
| 🔵 | `[🔵 検証中]` | テスト/レビュー実行中 |
| 🟡 | `[🟡 終了中]` | 終了処理中 |
| ⚪ | `[⚪ 終了]` | セッション終了 |

---

## 内部で呼び出されるワークフロー

`/go` は以下を内部で自動呼び出し:

| フェーズ | 内部ワークフロー |
|----------|-----------------|
| 開始時 | `/checkin`, `/dev` |
| 作業中（通常） | `/work`, `/verify` |
| 作業中（ビジョン） | `/vision-os`, `/debate --preset=titan`, `/verify` |
| 終了時 | `/ship`（任意）, `/checkout`, `/checkpoint_to_blog`（自動判定） |

**ユーザーはこれらを意識する必要なし**

---

## エスケープハッチ

自動判断を上書きしたい場合:

```
/go --manual     # 従来の個別コマンドモード
/go --no-dev     # 開発サーバー起動をスキップ
/go --skip-check # 環境チェックをスキップ
/go --vision     # ビジョン駆動モード（/vision-osを内部呼び出し）
```

---

## 設計原則

| 原則 | 実装 |
|------|------|
| **外在的負荷を最小化** | コマンド暗記不要 |
| **主導権感を維持** | 終了時は確認プロンプト |
| **状態を可視化** | 常に現在フェーズを表示 |
| **エスケープ可能** | 必要なら個別コマンドも使える |

---

> [!NOTE]
> **/go = セッションの始まりと終わり、そしてその間のすべて**
> **`--vision` でビジョンから始めれば、3巨頭が全てを導く**
