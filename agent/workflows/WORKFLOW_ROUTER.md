---
description: AIエージェントの自律駆動用ルーティングテーブル。全ワークフローの分岐条件・遷移先を集約。
---

# WORKFLOW ROUTER

## コマンドマッピング

| コマンド | WF | 自然言語トリガー |
|---------|-----|-----------------|
| `/go` | go.md | 「おはよう」「始めよう」/ 6h+空白 |
| `/checkin` | checkin.md | (go内部で自動) |
| `/checkout` | checkout.md | 「終わり」「また明日」 |
| `/work "タスク"` | work.md | 自然言語タスク指定 |
| `/spec` | spec.md | 「仕様」「設計」 |
| `/new-feature` | new-feature.md | 「新機能」「追加して」 |
| `/bug-fix` | bug-fix.md | 「バグ」「エラー」 |
| `/refactor` | refactor.md | 「整理」「見直し」 |
| `/verify` | verify.md | 実装完了時に自動 |
| `/error-sweep` | error-sweep.md | 「精査」「エラーチェック」 |
| `/ship` | ship.md | 「デプロイ」「公開」 |
| `/debate` | debate.md | 「レビュー」 |
| `/galileo` | galileo.md | 「本当に？」「検証して」 |
| `/fbl` | fbl.md | (verify内部で自動) |
| `/debug-deep` | debug-deep.md | (fbl自動エスカレーション) |
| `/checkpoint_to_blog` | checkpoint_to_blog.md | 「記事作成」 |
| `/level [0-3]` | level.md | 「慎重に」→L1 /「全自動」→L3 |
| `/vision-os` | vision-os.md | 「すごいもの作りたい」 |
| `/deploy` | deploy.md | (ship内部) |
| `/db-migrate` | db-migrate.md | 「マイグレーション」 |

## メインフロー

```
/go → /checkin → /work → Skill探索 → 開発WF → /verify → /ship → /checkout
```

## Skill-First 探索フロー

新機能・新技術に着手する前に:

```
1. ローカル確認: ~/.gemini/antigravity/skills/ に関連スキルあるか？
   ├─ Yes → view_file で SKILL.md を読んで適用
   └─ No ↓
2. 公式リポ探索（GitHub API で SKILL.md を検索）:
   ① anthropics/skills
   ② vercel-labs/agent-skills
   ③ supabase/agent-skills
   ④ VoltAgent/awesome-agent-skills（380+スキルのカタログ）
   ├─ Hit → ダウンロード＆インストール → 適用
   └─ Miss ↓
3. Web検索: "[技術名] agent skills SKILL.md github"
   ├─ Hit → 評価＆インストール → 適用
   └─ Miss → 自力実装（完了後スキル化を検討）
```

## 優先ルール

1. 明示コマンドは最優先（WF実行中でも割り込み可）
2. 安全性 > 自律性（破壊的操作はユーザー確認必須）
3. verify は省略不可（開発WF → verify → ship の順守）
4. verify は規模自動判定（Phase 0で変更規模から判定）
5. **Skill-First**: 新領域の実装前に公式スキル探索を行う
