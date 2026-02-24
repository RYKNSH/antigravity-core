# Round 2: "Invisible Incident" 構造 × 2つの Core の共存問題

**日時**: 2026-02-23T23:45:00+09:00
**前ラウンドからの焦点**: watchdog のサイレント give-up が問題を不可視化している / `update_usage_tracker.sh` が毎回ハングする真因 / `~/.gemini/antigravity` vs `~/.antigravity` の2core共存混乱

---

## 議論

**🤔 Skeptic**:
「`update_usage_tracker.sh` を実際に読んだ。ハング候補を探す。`sed -i ''` を使っている（行55）。macOSでは `sed -i ''` は in-place 編集の正規構文だが、`TRACKER_FILE` が存在しなかった場合はexit 0で正常終了する。では何がハングしているか？

`grep "| /$WORKFLOW_NAME |" "$TRACKER_FILE"` — これは単純なgrepのはず。では checkout.md の `_smart_run 10 1 "usage-tracker"` が10秒でkillしているのは、なぜか？ 

→ 問いを立て直す：**このスクリプト自体がハングしているのではなく、`_smart_run` のstall検知ロジックが出力無し＝stall と誤判定しているのではないか？**

スクリプトの出力は `echo "✅..."` が1行出るだけ。もしそれが tmpout に流れた後、次の出力がなければ cur_size が固定され stall_count が増える。10秒後に kill。→ 正常動作なのに stall と誤判定されている可能性が高い。」

**😈 Devil's Advocate**:
「Skepticの仮説は甘い。本当にそうならば brain_log に「10秒で終了した」と書かれるはず。しかし 2026-02-17 の記録には『毎回ハング』と書かれている。つまり10秒以上何かを待っている。

考えてみろ。`TRACKER_FILE` が `$HOME/.antigravity/USAGE_TRACKER.md` を指すとき、そのファイルに書き込みロックがかかっている場合は？ checkout.md は複数のジョブを並列実行している（`&` で複数バックグラウンド）。もし先行ジョブが `USAGE_TRACKER.md` を編集中にこのスクリプトが走れば、ファイルロック競合でブロックされる。

**根本：checkout の並列実行設計が、同一ファイルへの競合書き込みを引き起こしている。**」

**🔬 Systems Analyst**:
「では2つのcore問題を整理する。

**`~/.antigravity/` (Core-A: 本体)**
- git管理下。`~/.antigravity/.git/` 存在
- workflows, skills, scripts, rules, incidents.md を管理
- `checkout.md` が auto-commit + push を実行

**`~/.gemini/antigravity/` (Core-B: AIの脳)**
- git管理**外**（INC-001の根本原因）
- `brain/`, `skills/` (グローバルスキル群), `browser_recordings/`
- AIが自分の作業ログ・アーティファクト・スキルを置く場所

**この2つは完全に別目的だが、名前が似すぎて AI が混同する。**

| 項目 | Core-A `~/.antigravity` | Core-B `~/.gemini/antigravity` |
|------|------------------------|-------------------------------|
| 管理主体 | ユーザー（git push で永続化） | AI エージェント（セッション固有） |
| git管理 | ✅ あり | ❌ なし |
| 永続化 | gitで担保 | セッション間で揮発する可能性 |
| AIのアクセス頻度 | 全セッション（workflow読み込み） | 全セッション（brain/artifacts書き込み） |
| 混同リスク | 毎セッション（特にgit操作時） | — |

INC-001はこの混同の結果。しかし **safe-commands.mdに「git操作前にグラウンディング確認」を追加しただけ**。根本（2つのcoreを区別するディレクトリ構造の明示化）には手が付いていない。

さらに問題がある。**Core-B (`~/.gemini/antigravity/skills/`) には global スキルが置かれているが、これはgit管理外。スキルが改善されても次のAIセッションで参照される保証がどこにもない。**」

**🧠 Root Cause Hunter**:
「ブラウザサブエージェントのスタック（H-03）に5 Whysを適用する。

- **Why 1**: ブラウザサブエージェントがSupabase/Railway UIでスタックした
- **Why 2**: UIが変わっているか、MFA壁があるか、認証フローが複雑だった
- **Why 3**: サブエージェントはページ構造への適応を繰り返し試み、タイムアウトまで実行し続けた
- **Why 4**: サブエージェントに「N回失敗したら別アプローチに切り替えろ」というルールが徹底されていなかった
- **Why 5（根本）**: safe-commands.mdの保護ルールはターミナルコマンド専用で、ブラウザサブエージェントの行動ルールをカバーするファイルが存在しない

→ すなわち、**ブラウザサブエージェントは core 環境（safe-commands.md・incidents.md）の保護圏外で動いている**。プロじゃない領域で野放しになっている。

brain_log の改善提案「ブラウザ操作3回失敗→即別アプローチ」は brain_log に書かれるだけで、**core の safe-commands.md や incidents.md に記録されていない**。だから次セッションの AI は同じ失敗を繰り返す。」

---

## 🧭 Moderator Summary

| 項目 | 内容 |
|------|------|
| 明確になったこと | ①`update_usage_tracker.sh` のハングは「スクリプト自体のバグ」ではなく `_smart_run` の**誤ったstall判定**か**並列書き込み競合**のどちらか ②2つのCore（Core-A git管理/Core-B git管理外）の役割が未文書化で、AIが毎セッション混同リスクを抱える ③ブラウザサブエージェントはcore保護圏外で動作し、失敗パターンがcore環境に反映されない「学習の非対称性」が存在する |
| まだ詰まっていない論点 | ①「学習の非対称性」を解消するアーキテクチャとは何か（incidents.mdだけで足りるのか）②Core-Aとcore-Bを今後どう整理するか。リネーム？明示的なREADME？③`update_usage_tracker.sh`の競合書き込み仮説を検証するには何が必要か（実装なしで論じられるか） |
| 次ラウンドの焦点 | **「学習の非対称性」と「2Core整理」の設計論**。何が本質的な解決策か、実装なしで命題を定式化する |
| **判定** | `Continue` — 根の論点（学習非対称性・2Core設計）が出た。Round 3で詰める |
