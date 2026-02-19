---
description: セッションコンテキストを圧縮して永続化し、情報の損失を防ぐ
---

# /context-compression

> スキル `context-compression` のラッパーWF

## 使用方法

```
/context-compression [Focus: 保持したい情報]
```

## 実行

1. スキル `~/.gemini/antigravity/skills/context-compression/SKILL.md` を読む
2. スキルに従い、現在のセッションコンテキストを圧縮
3. `NEXT_SESSION.md` に圧縮結果を保存
4. `.session_state.json` を更新

## 圧縮テンプレート

```markdown
# 圧縮コンテキスト

## 現在のタスク
[task.md の要約]

## 変更ファイル
[編集したファイルパス一覧]

## 重要な決定
[アーキテクチャ決定、トレードオフ]

## 未完了
[残りのタスク]

## エラー / 教訓
[発生したエラーと解決策]
```
