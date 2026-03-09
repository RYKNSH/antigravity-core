---
description: COO（Antigravity Core）が Daemon Core にタスクを委譲するかどうかの判断ルール
---

# Daemon 委譲ルール

## 基本方針

> **COO = 設計・判断・コミュニケーション**  
> **Daemon = コード実装・テスト実行・反復作業**

---

## ✅ Daemon に委譲するケース

| 条件 | 例 |
|-----|-----|
| 要件が明確でファイルに落とせる | 「テスト書いて」「バグ直して」「実装して」 |
| 繰り返し・定型的な実装 | CRUD, テストファイル生成, リファクタ |
| 品質ゲートで合否判定できる | pytest PASS / lint CLEAN / build OK |
| Human の判断不要 | LLM に丸投げで完結するもの |
| 並列で複数プロジェクトを回したい | タスクキューに積んで放置でいいもの |

**委譲手順:**
```
1. Daemon が起動しているか確認（docker ps）
2. 起動していなければ docker-compose up -d
3. core-run.js でタスクをキューに積む
4. Daemon が自律実行 → 完了を session_state.json で確認
```

---

## ❌ COO が直接やるケース

| 条件 | 例 |
|-----|-----|
| ユーザーと対話しながら設計が必要 | 仕様決め・アーキテクチャ議論 |
| Daemon が止まっている / 起動確認できない | 今回の VID BUDDY がこれ |
| MCP・外部API・ブラウザ操作が必要 | Discord送信・Notion更新 |
| 緊急（ユーザーが今すぐ結果を必要としている） | デモ直前のバグ修正など |
| タスクが曖昧でまず整理が必要 | 「なんとかして」系 |

---

## 🔁 セッション開始時の自動チェック

`/checkin` 実行時に以下を自動確認:
```bash
docker ps --filter "name=daemon_core" | grep Running
```
- **Running** → タスクがあれば Daemon に積む
- **停止中** → `docker-compose up -d` してから積む
- **起動失敗** → COO が直接処理、後でインシデント記録

---

## 判断フローチャート

```
ユーザー指示
     │
     ▼
要件をファイルで渡せる？
  ├─ NO  → COO が直接実装
  └─ YES → Daemon は起動中？
              ├─ NO  → 起動してから委譲
              └─ YES → core-run.js でキュー積み → Daemon に委譲
```
