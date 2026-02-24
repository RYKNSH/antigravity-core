# Round 1: ハングパターンの3分類 × global core環境との初期仮説

**日時**: 2026-02-23T23:35:00+09:00
**前ラウンドからの焦点**: 初回。収集データから全体像を把握する。

---

## 📊 収集ハングインベントリ（事実ベース）

| # | 発生場所 | 症状 | 記録ステータス |
|---|---------|------|--------------|
| H-01 | `~/.gemini/antigravity/` での git push | 無限ハング（auth prompt待ち） | INC-001 [FIXED] |
| H-02 | checkout.md での `update_usage_tracker.sh` | 毎セッション checkout でハング | brain_log/2026-02-17 [未修正] |
| H-03 | ブラウザサブエージェント（Supabase/Railway） | 何度もスタック。効率 2/5 を引き起こす慢性的問題 | brain_log/2026-02-23 [未修正] |
| H-04 | git push → `\| tail -3` パイプ | stdout バッファで完了シグナルが消える | safe-commands.md [FIXED] |
| H-05 | git terminate後 → `.git/index.lock` 残留 → 次git競合 | ブロック | safe-commands.md [FIXED] |
| H-06 | `checkout.md`を使わず独自gitチェーン再実装 | watchdog・stall検知が消え無限ハング | safe-commands.md [FIXED] |

---

## 議論

**🤔 Skeptic**:
「safe-commands.mdに根本原因が3つ書かれている。全部 "FIXED" だ。なのになぜ 2026-02-23 のセッション評価は効率 2/5 なのか？ "FIXED" というのは本当に修正されているのか？それとも、修正したはずがAIの次セッションにまったく伝達されていないのではないか？」

→ 問いの本質：**パターンは記録されているが、AIは次セッションで同じ失敗を繰り返しているのではないか？**

**😈 Devil's Advocate**:
「効率 2/5 の原因は『git系ハング』ではなく『ブラウザサブエージェントのスタック』だ。H-01〜H-06はgit系の話で、H-03は全く別のレイヤーの問題。つまり safe-commands.md はgit操作の保護しかできていない。ブラウザサブエージェントのハング（H-03）はまったく対処されていない別カテゴリの問題だ。safe-commands.mdの記録範囲が狭すぎる。」

**🔬 Systems Analyst**:
「これをシステム観点で3分類すると：

**分類A: 環境前提ミス型**（H-01）
- AIのワールドモデルと実ファイルシステムの乖離
- `~/.gemini/antigravity/` ≠ `~/.antigravity/` という "2つのcore" の区別失敗
- **global core環境との関連**: High。`.gemini/antigravity`と`.antigravity`が似た名前で共存している点が混乱源

**分類B: プロセス実行型**（H-02, H-04, H-05, H-06）
- シェルスクリプトのパイプ・バッファ・lockファイルに依存するタイミング問題
- checkout.mdの内部スクリプトレベルの問題
- **global core環境との関連**: Medium。`ANTIGRAVITY_DIR`環境変数の設定状態に依存する

**分類C: 外部API依存型**（H-03）
- ブラウザサブエージェント→Supabase/Railway UIの応答待ち
- ページ構造変化・MFA壁・ネットワーク遅延で無限待機
- **global core環境との関連**: Low（外部サービス依存）、ただし対処ルールがcore環境に記録されていないという意味でLowではない
」

**🧠 Root Cause Hunter**:
「H-02の`update_usage_tracker.sh`が『毎回』ハングしていることに注目する。2026-02-17のbrain_logに「次回要調査」と書かれ、2026-02-23時点でも未修正。つまり少なくとも **6日以上** 毎チェックアウトで同じハングが発生し続けている。

なぜ修正されないか？
- Why 1: checkout.md のwatchdogが90秒後にkillするので、ユーザーへの影響が小さく見える
- Why 2: _smart_run 10 1 "usage-tracker" と設定され、10秒stall→kill→リトライ1回→give upで続行される
- Why 3: give up後も checkout は続行するので、ユーザーはハングを認識しない
- Why 4: 失敗ログが CHECK OUT COMPLETE! の流れに埋もれ、incidents.md に記録されない
- **Why 5（根本）: checkout の watchdog がハングを隠蔽することで、問題が "invisible incident" になっている**
」

---

## 🧭 Moderator Summary

| 項目 | 内容 |
|------|------|
| 明確になったこと | ①ハングは3分類（環境前提ミス型/プロセス実行型/外部API依存型）②safe-commands.mdの修正はgit系のみをカバー、H-03は完全に対処外 ③watchdogの「サイレントgive-up」が問題の不可視化を引き起こしている |
| まだ詰まっていない論点 | ①H-02(`update_usage_tracker.sh`)の実際のハング原因。②分類Aで浮かび上がった「2つのcore(`~/.gemini/antigravity` vs `~/.antigravity`)の共存」がなぜ存在しその混乱がどれだけあるか ③H-03のブラウザスタックのパターンに構造的な解決策があるか |
| 次ラウンドの焦点 | **「invisible incident」構造と2つのcoreの関係**。watchdogが問題を隠蔽するメカニズムと、H-02の実際の原因を5Whysで掘る |
| **判定** | `Deep Dive` — watchdog隠蔽・2core共存問題は表面的に触れただけ。次ラウンドで根に触れる |
