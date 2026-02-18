# 安全コマンドホワイトリスト & 防弾プロトコル

## 🛡️ Kinetic Command Rules
単発の静的コマンドは禁止。必ず連鎖コマンドを使用。

| ルール | ❌ 禁止 | ✅ 正解 |
|--------|---------|--------|
| 静的cd禁止 | `cd backend` | `cd /full/path && echo "$PWD"` |
| Self-Healing | `python main.py` | `(lsof -ti:8000 \| xargs kill -9 2>/dev/null \|\| true) && python main.py` |
| 検証付き | `rm file.txt` | `rm file.txt && ! ls file.txt` |

---

## 許可コマンド (SafeToAutoRun: true)

**読み取り専用**: `ls`, `cat`, `head`, `tail`, `grep`, `find`, `fd`, `df -h`, `du -sh`, `git status/diff/log`, `pwd`, `which`, `echo`, `lsof`
**ビルド・テスト**: `pnpm lint/test`, `vitest`, `tsc --noEmit`
**パッケージ確認**: `pnpm list`, `npm list`

## 🔒 Git Safety Rules

| ルール | 説明 |
|--------|------|
| プロジェクトバウンダリ | `git add/commit/push` 前に `git rev-parse --show-toplevel` 確認 |
| 1タスク=1プロジェクト | 複数プロジェクトにまたがるgit操作禁止 |

## 禁止コマンド
- `--dangerously-skip-permissions`
- `rm -rf /` 系
- 本番への直接デプロイ（`/deploy` WF経由必須）
- 相対パスへの `cd`（トラブル時）

## Experiential Guards
- 広範囲スキャンはスコープを絞る
- ネットワーク依存はフォールバックを考慮
- 長時間コマンドが返らない → 別アプローチを試す

## ⏱️ Timeout Guard (3-Layer Defense)

```
Layer 1: perl -e 'alarm 10; exec @ARGV' <cmd>  (通常のハング対策)
Layer 2: run_command(WaitMsBeforeAsync=500) → Background → Terminate  (D state対策)
Layer 3: write_to_file/view_file でAPI直接操作  (ターミナル全滅時)
```

| 操作 | リスク | Layer |
|------|--------|-------|
| 小ファイルcp/mv | 低 | 1 |
| rm -rf（ディレクトリ） | 高 | 2 |
| 大量ファイルコピー | 中 | 1→2 |
| ターミナル全滅 | 最高 | 3 |
