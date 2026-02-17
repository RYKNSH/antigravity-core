---
description: Autonomy Levelの即時切替。モードスイッチコマンド。
---

# /level — Autonomy Level 切替

## 使用方法

```
/level          現在のAutonomy Level表示
/level 0        L0 (Manual) に切替
/level 1        L1 (Supervised) に切替
/level 2        L2 (Autonomous) に切替
/level 3        L3 (Full Auto) に切替
```

## エイリアス

| Short | Long | 自然言語トリガー |
|-------|------|---------------|
| `/level 0` | `/level manual` | 「慎重にやって」「手動で確認して」 |
| `/level 1` | `/level careful` | 「確認しながら」「一つずつ」 |
| `/level 2` | `/level auto` | 「いつも通りで」「自動で」 |
| `/level 3` | `/level turbo` | 「全自動で」「止まらないで」 |
| `/level` | — | 「今のレベルは？」 |

---

## 実行ロジック

### `/level`（引数なし）: 現在レベル表示

```markdown
⚙️ Autonomy Level: **L2 (Autonomous)**

| Level | 名前 | PAUSE条件 |
|-------|------|-----------|
| L0 | Manual | 全ステップで確認 |
| L1 | Supervised | 設計承認 + 破壊的操作 |
| **→ L2** | **Autonomous** | **破壊的操作のみ** |
| L3 | Full Auto | 本番のみ確認 |

切替: `/level 0` `/level 1` `/level 2` `/level 3`
```

### `/level 0`-`/level 2`: 即時切替

1. `.session_state` の `autonomy_level` を更新
2. 確認メッセージを1行表示:

```markdown
⚙️ L2 (Autonomous) → **L1 (Supervised)** に切替完了
```

3. `.antigravity_config` は**変更しない**（セッション内のみ有効）

### `/level 3`: 確認付き切替

> [!CAUTION]
> L3はstaging自動デプロイが有効になるため、1回だけ確認する。

```markdown
⚠️ L3 (Full Auto) に切替えますか？
- staging環境への自動デプロイが有効になります
- 本番デプロイのみ確認が残ります
(y/N)
```

承認後:
```markdown
⚙️ L2 (Autonomous) → **L3 (Full Auto)** に切替完了
```

---

## スコープ

| 項目 | 動作 |
|------|------|
| 有効範囲 | **セッション内のみ** |
| 永続設定 | `.antigravity_config` を直接編集 |
| デフォルト | `.antigravity_config` の値。未設定時は **L2** |
| 復帰 | 次セッション開始時に `.antigravity_config` のデフォルトに戻る |

---

## Autonomy Level 詳細

各レベルのPAUSE条件は `WORKFLOW_CONTRACTS.md` の「Autonomy Level」セクションを参照。

| Level | 名前 | 要約 |
|-------|------|------|
| L0 | Manual | 全ステップで確認。デバッグ・慎重な操作向け |
| L1 | Supervised | 設計承認 + 破壊的操作で確認。初期段階の開発向け |
| L2 | Autonomous | 破壊的操作のみ確認。バイブ開発のデフォルト |
| L3 | Full Auto | 本番デプロイのみ確認。信頼関係確立後 |

