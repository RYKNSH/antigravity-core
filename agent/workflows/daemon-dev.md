---
description: Daemon Core開発セッション開始時の定型フロー。WHITEPAPER.mdを参照し指向性を確認してから開発に入る。
---

# /daemon-dev — Daemon Core Dev Session

// turbo-all

## 1. 前回のコンテキスト復元
- `~/.antigravity/NEXT_SESSION.md` があれば読み込む
- `git log -n 5 --oneline`

## 2. プロジェクトの現在地を把握
- `~/.antigravity/docs/SERVICE_REGISTRY.md` — 全社の最新ステータス

## 3. 判断の軸をロード
- `~/.antigravity/docs/WHITEPAPER.md` — ビジョン・ミッション・アーキテクチャの確認（特に Chapter 11: CEO-COO-Daemon Trinity）

## 4. 今のPhaseと進行中のマイルストーン確認
- `~/.antigravity/docs/ROADMAP.md` — 現在のPhaseと責務を確認（Phase 5-7: Daemon Core Architecture）
- `~/.antigravity/docs/MILESTONES.md` — 進行中(🔶)のマイルストーンと完了条件を特定

## 5. 今日のタスク選定
- `~/.antigravity/docs/TASKS.md` の「今すぐ着手可能なタスク」から優先度の高いタスクを提案する

選択基準（優先順）:
1. **前回の継続タスク**（NEXT_SESSION.md）
2. **依存関係が解消済みのタスク**
3. **工数「小」のタスク**（モメンタム確保）

## 6. Boundary Protocol 確認
- ✅ 担当ディレクトリ: `~/.antigravity/docker-core/` (Daemon Core本体)
- ✅ 担当ディレクトリ: `~/.antigravity/agent/scripts/` (共通スクリプト)
- ❌ 禁止: 他プロジェクト（DISCORD BUDDY等）のコード修正

## 7. 実行開始
ユーザーの承認を得たら `/go` で実行開始。

---

### 参照用ドキュメント（必要な時のみ）
| ファイル | いつ読む |
|---------|---------|
| `WHITEPAPER.md` Chapter 11 | 戦略の根拠を確認したい時 |
| `docker-core/` 内ファイル群 | Daemon Core のソースを確認したい時 |
| `knowledge/openclaw_autonomous_ai_architecture/` | OpenClawの参照アーキテクチャを確認したい時 |
| `agent/scripts/session_state.js` | State Hydration / Gateway の仕組みを確認したい時 |
