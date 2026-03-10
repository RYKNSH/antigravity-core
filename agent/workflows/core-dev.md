---
description: Antigravity Core開発セッション開始時の定型フロー。WHITEPAPER.mdを参照し指向性を確認してから開発に入る。
---

# /core-dev — Antigravity Core Dev Session

// turbo-all

## 1. 前回のコンテキスト復元
- `~/.antigravity/NEXT_SESSION.md` があれば読み込む
- `git log -n 5 --oneline` in `~/.antigravity/`

## 2. プロジェクト現在地の把握
- `~/.antigravity/docs/WHITEPAPER.md` — Section 12（Four-Loop Quality Governance）を必ず確認する

## 3. 今のPhaseと進行中のマイルストーン確認
- `~/.antigravity/docs/ROADMAP.md` — Phase 8（Four-Loop Quality Governance）の現在地を確認
- `~/.antigravity/docs/MILESTONES.md` — 進行中(🔶)のMS 8.xと完了条件を特定

## 4. 今日のタスク選定
- `~/.antigravity/docs/TASKS.md` の「Phase 8」セクションから今すぐ着手可能なタスクを選定

選択基準（優先順）:
1. **前回の継続タスク**（NEXT_SESSION.md）
2. **依存関係が解消済みのタスク**（8.1.1 → 8.1.2 → ... の順）
3. **工数「小」のタスク**（モメンタム確保）

**現在の推奨タスク順序（Phase A）**:
```
8.1.1 bootstrap-goals.js → 8.1.2 TEOスキーマ → 8.1.7 QES初期化
→ 8.1.3 4軸スコア計測 → 8.1.6 Environment Check → 8.1.4 COO-Lite
→ 8.1.5 rate limit → 8.1.8 E2E
```

## 5. Boundary Protocol 確認
- ✅ 担当ディレクトリ: `~/.antigravity/` + `~/.antigravity/docker-core/`
- ❌ 禁止: プロジェクト固有コードへの影響 / 共有基盤の無断変更

## 6. 実行開始
`/go` で実行開始。

---

### 重要な設計先決事項（実装前に必ず確認）

| 確認項目 | 所在 |
|---------|------|
| QES換算値・ルール | WHITEPAPER.md Section 12.3 |
| Four-Loopアーキテクチャ全体図 | WHITEPAPER.md Section 12.2 |
| COO-Lite Rate Limit | WHITEPAPER.md Section 12.5 |
| proper-lockfileの要検証フラグ | WHITEPAPER.md Section 12.8 |
| 全タスク詳細 | TASKS.md Phase 8 |
