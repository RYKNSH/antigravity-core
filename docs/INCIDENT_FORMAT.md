# INCIDENT_FORMAT — brain_log 構造化フォーマット定義

> **目的**: brain_logをCoreが自動読み取り可能な形式で定義する。
> これにより手動での昇格判断ゼロで、実践ハングがサーバーサイドCIに届く。
>
> **参照**: WHITEPAPER.md §7 / dependency_map.json `brain_log` セクション

---

## フォーマット仕様

brain_log内の各エントリは以下2種類のいずれかで記述する。

### INCIDENT エントリ（ハング・エラー記録）

```markdown
## [INCIDENT] session_MMDDHHNN
- type: hang | error | silent_failure | auth_block
- component: [スクリプト名/WF名]
- trigger: [何が原因でハングしたか]
- duration: [ハング継続時間 or ">Ns (smart_run kill)"]
- layer: terminal | browser | network | git | filesystem
- resolution: pending | [解決方法]
- status: OPEN | FIXED | WONT_FIX
- related_wf: [影響を受けるWF名（複数可）]
```

### FIXED エントリ（解決済みのインシデント記録）

```markdown
## [FIXED] session_MMDDHHNN
- type: hang | error | silent_failure | auth_block
- component: [スクリプト名/WF名]
- trigger: [何が原因だったか]
- resolution: [何をして解決したか]
- fix_file: [修正したファイル名]
- status: FIXED
- related_wf: [影響を受けたWF名]
```

---

## サンプル: OPENインシデント

```markdown
## [INCIDENT] session_02170930
- type: hang
- component: update_usage_tracker.sh
- trigger: 並列実行時のsed -i競合（flock未使用）
- duration: >20s (smart_run kill)
- layer: filesystem
- resolution: pending
- status: OPEN
- related_wf: checkin, checkout
```

## サンプル: 解決済みインシデント

```markdown
## [FIXED] session_02241054
- type: hang
- component: notion_poster.js
- trigger: .env not found → HTTPS タイムアウト
- resolution: ~/.antigravity/.env を ~/.antigravity-private/.env へのシムリンクに変更
- fix_file: setup.sh
- status: FIXED
- related_wf: blog
```

## サンプル: ブラウザSAのブロック

```markdown
## [INCIDENT] session_02231430
- type: auth_block
- component: browser_subagent
- trigger: Supabase UI で MFA壁に遭遇
- duration: 3回リトライ後に切り替え
- layer: browser
- resolution: mcp_supabase_* に切り替えて完了
- status: FIXED
- related_wf: fbl, deploy
```

---

## Coreによる自動集計クエリ例

```bash
# 未解決ハング一覧
grep -r "status: OPEN" ~/.antigravity/brain_log/

# コンポーネント別ハング頻度
grep -r "component:" ~/.antigravity/brain_log/ | sort | uniq -c | sort -rn

# WF別影響頻度
grep -r "related_wf:" ~/.antigravity/brain_log/ | grep "checkout" | wc -l
```

---

## checkout.mdによる自動出力ルール

checkout.md はセッション終了時に以下を自動実行する:
1. そのセッション中に発生したハング（safe-commands.md フェーズ2.5で報告済み）を `[INCIDENT]` エントリとして書き出す
2. そのセッション中に解決したインシデントを `[FIXED]` エントリとして書き出す
3. 出力先: `~/.antigravity/brain_log/session_MMDDHHNN.md`
