# Round 3: 「学習の非対称性」と「2Core設計論」— 構造的問題の定式化

**日時**: 2026-02-23T23:55:00+09:00
**前ラウンドからの焦点**: 学習の非対称性（bare_log→core未反映）/Core-A/B整理/update_usage_tracker.sh競合仮説

---

## 議論

**🤔 Skeptic**:
「Round 2で出た『学習の非対称性』を正確に定義する。

- **Core-A（~/.antigravity）** は git 管理下。改善がコミットされれば次セッションのAIも参照できる
- **Core-B（~/.gemini/antigravity）** は git 管理外。AI が brain_log に書いても次セッションで消える可能性がある
- **ブラウザ失敗の改善案** は brain_log（Core-B）にのみ書かれる → Core-A（safe-commands.md）に転記されない限り揮発する

これを確認しよう。2026-02-17 の brain_log には 『update_usage_tracker.sh は checkout で毎回ハングする → 次回要調査』と書かれている。→ 2026-02-23 のbrain_logを見ると、それへの言及がない。→ **6日後のAIはそのインシデントを知らずにまた同じ状況に入った可能性が高い。**

なぜ brain_log の情報が次セッションに伝わらないか？ `/checkin` ワークフローが brain_log を読んでいるか？」

**😈 Devil's Advocate**:
「checkin.md を持ち出す前に確認すべき事がある。

仮に checkin が brain_log を読んでいたとしても、**AIは読んだことを "理解" するが "行動" するとは限らない**。

証拠：safe-commands.md に『update_usage_tracker.sh はcheckoutで毎回ハングする → 次回要調査』は書かれていない。もし checkin が brain_log を読んで AI がその記事を認識したなら、どこかで safe-commands.md に追記されているはずだ。されていない。

つまり brain_log → AI 認識 → 修正アクション というループが機能していない。なぜか？ **checkin は brain_log の "最新1件" しか読まない設計になっていると推測する。** 2026-02-17 のログは 2026-02-23 では最新ではないため、読まれていない。

→ 根本：**brain_log は蓄積されるが、消費ロジックが最新1件に限定されている。過去の未解決インシデントが永久に埋もれる。**」

**🔬 Systems Analyst**:
「2Core問題の構造設計論を整理する。

現状の問題は『名前の類似性』ではない。**役割定義の文書が存在しないこと**だ。

```
~/.antigravity/        ← Core-A: Workflow Engine（人間とAIの共有インフラ）
~/.gemini/antigravity/ ← Core-B: AI Brain（AIの個人ワークスペース）
```

この2つを1ページで説明した公式ドキュメントがない。ゆえにAIは初回セッションで推測に頼り、推測を誤る（INC-001）。

**2Core整理に最小限必要なもの（実装なしで定義可能）**:

1. `~/.antigravity/README.md` に "このディレクトリはgit管理のWorkflow Engine" と明示
2. `~/.gemini/antigravity/README.md`（または `RULES.md`）に "このディレクトリはgit管理外のAI作業ログ。pushしてはいけない" と明示
3. `checkin.md` のStep 0に '2Core確認' を追加：git操作前に常に上記READMEを参照させる

この3件は **実装禁止ルールの /refine の範囲内で策定できる**。ドキュメント変更は "議論" の範疇だ。

さらに重要な観察：

**Core-B 内の global スキル（`~/.gemini/antigravity/skills/`）はCore-A管理外のため、スキルが更新されても git に乗らない。スキルの改善がリセットされるリスクがある。**

これはスキルという "AI の能力資産" の永続化設計の欠陥だ。frontend-design, context-compression 等のグローバルスキルがCore-B（非git）に置かれている理由は何か？ → それが Antigravity の "portability" 設計なのか、単なる場当たり的な配置なのかが未決定。」

**🧠 Root Cause Hunter**:
「全ての問題を1つの命題に収束させる。

**命題：Antigravity における "学習のループ" が閉じていない**

```
[インシデント発生]
    ↓
[brain_log に記録] ← Core-B（揮発可能）
    ↓
[次セッションで checkin が参照？] ← 最新1件のみ
    ↓
[safe-commands.md に反映] ← 手動 or AIが自発的に判断
    ↓
[incidents.md に記録] ← 今は INC-001 のみ正式記録
    ↓
[Core-A に git push] ← ここで初めて永続化
```

このループのどこが詰まっているか？

**詰まり1**: brain_log→safe-commands.md の反映が自動ではなく、AIの自発的判断に依存  
**詰まり2**: incidents.md の記録ルールが「/incident を実行する」前提。自発的実行がされていない（INC-002〜が空白）  
**詰まり3**: ブラウザサブエージェントのインシデントは、ターミナルコマンドのincidentと別カテゴリのため、safe-commands.mdのスコープ外  

**→ 根本: 学習ループの "転記トリガー" が存在しない**

checkout.md は commit するが、「未解決インシデントを incidents.md に転記する」ステップがない。checkout は "セッションを閉じる" だけで "学習を固定す" にはなっていない。」

---

## 🧭 Moderator Summary（最終）

| 項目 | 内容 |
|------|------|
| **明確になったこと（全3ラウンド統合）** | ①ハングは3分類（環境前提ミス型/プロセス実行型/外部API依存型）②watchdog/smart_runがハングを隠蔽し、インシデントが invisible になる ③2つのCore（git管理/非管理）が未文書化で共存し、AIが毎セッション混同リスクを抱える ④学習ループの「転記トリガー」が存在しない。brain_log → core 反映が自動化されていない ⑤ブラウザサブエージェントはcore保護圏外で動き、その失敗パターンが永続化されない |
| **構造的問題の定式化** | **「Antigravityは高度なハング対策(watchdog/smart_run)を持ちながら、そのハング対策がインシデントを隠蔽し学習ループを閉じえないという逆説的な構造を持っている」** |
| **設計変更の命題（実装なし）** | 1. 2Coreの役割を公式ドキュメントで分離明示する 2. checkout.md に「未解決インシデントを incidents.md に転記する」ステップを追加すべき 3. ブラウザサブエージェント専用の失敗ルールファイルを safe-commands.md とは別に作成すべき 4. incidents.md の記録範囲を "ターミナル操作" から "全操作（ブラウザ含む）" に拡張すべき |
| **次のアクション（ユーザー判断）** | `/gen-dev` でこの分析をホワイトペーパー化 / `/go` で上記4命題のうちどれから実装するかを決定 |
| **判定** | `Conclude` — 3ラウンドを経て根本問題が定式化された。議論は出尽くした |
