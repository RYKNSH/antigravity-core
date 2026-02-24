---
description: Antigravity Core Self-Improving Pipeline開発セッション開始時の定型フロー。WHITEPAPER.mdを参照し指向性を確認してから開発に入る。
---

# /core-ci-dev — Core CI Pipeline Dev Session

// turbo-all

## 1. 前回のコンテキスト復元
- `~/.antigravity/NEXT_SESSION.md` があれば読み込む
- `git -C ~/.antigravity log -n 5 --oneline`

## 2. プロジェクトの現在地を把握
- 現在のPhaseと完了済みMSを確認

## 3. 判断の軸をロード
- `~/.antigravity/refine/hang-log-global-correlation/WHITEPAPER.md` — ビジョン・設計原則の確認

## 4. 今のPhaseと進行中のマイルストーン確認
- `~/.antigravity/docs/ROADMAP.md` — 現在のPhaseと責務を確認
- `~/.antigravity/docs/MILESTONES.md` — 進行中(🔶)のマイルストーンと完了条件を特定

## 5. 今日のタスク選定
- `~/.antigravity/docs/TASKS.md` の「今すぐ着手可能なタスク」から優先度を提案

選択基準（優先順）:
1. **前回の継続タスク**（NEXT_SESSION.md）
2. **依存関係が解消済みのタスク**
3. **工数「小」のタスク**（モメンタム確保）

## 6. Boundary Protocol 確認
- ✅ 担当ディレクトリ: `~/.antigravity/`
- ✅ 変更対象: `agent/workflows/` `agent/rules/` `agent/scripts/` `docs/` `dependency_map.json`
- ❌ 禁止: 各プロジェクト（AntigravityWork配下）のコード修正
- ❌ 禁止: `~/.antigravity-private/` の内容をgit add

## 7. 実行開始
ユーザーの承認を得たら `/go` で実行開始。

---

### 参照用ドキュメント（必要な時のみ）
| ファイル | いつ読む |
|---------|---------|
| `refine/hang-log-global-correlation/WHITEPAPER.md` | 設計原則の根拠を確認したい時 |
| `dependency_map.json` | ハングの影響範囲を調べたい時 |
| `incidents.md` | 未解決インシデントを確認したい時 |
| `refine/hang-log-global-correlation/round_*.md` | ディベートの詳細を確認したい時 |
