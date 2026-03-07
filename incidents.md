# Incident Registry
> セッション中に発生した失敗・ハング・フリーズ・承認待ち・**ブラウザスタック**の記録。揮発させず結晶化する。

**Last Updated**: 2026-03-07
**Total Incidents**: 0

---

## 記録ルール

- 発生したらすぐに `/incident` を実行して記録する
- 根本原因まで掘る（タイムアウト不足等の表面的な原因は書かない）
- 対処を `safe-commands.md` や workflow に反映してから `[FIXED]` にする

| ステータス | 意味 |
|---|---|
| `[OPEN]` | 再発防止策未適用 |
| `[FIXED]` | safe-commands / workflow に反映済 |
| `[WONTFIX]` | 外部要因につき対処困難 |

---
