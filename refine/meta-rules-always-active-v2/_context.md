# Refine Session v2: メタルールをAIの常時アクティブなコンテキストにする仕組み

**開始日時**: 2026-02-24T19:46 JST
**テーマスラッグ**: `meta-rules-always-active-v2`
**モード**: rounds = 3（最低）/ Quality > /debate deep

---

## 🔍 Step 0: Knowledge Injection 結果

| ソース | 内容 | 重要な事実 |
|--------|------|-----------|
| `~/.gemini/GEMINI.md` (62行) | AIのグローバルルール | `safe-commands.md` `code-standards.md` を既に参照。しかし今日ターミナルハングが発生した |
| `~/.antigravity/agent/rules/GEMINI.md.master` | GEMINI.md の元ファイル | GEMINI.md と同一内容。DECISION_USECASES.md への参照は**一切ない** |
| `DECISION_USECASES.md` | 14ケース・9MR・約10KB | GEMINI.md に未リンク。今日のセッションで整備した |
| `checkin.md` | セッション開始WF | NEXT_SESSION.md を読む仕組みを本日追加済み（前例として有効） |
| LLM Attention機構 | 一般知識 | コンテキストの先頭・末尾のトークンは中段より attention weight が高い |

**核心的な反証データ**:
> `GEMINI.md` は既に `safe-commands.md` を参照している。
> しかし今日のセッションで `rsync` によるI/Oブロックが2時間以上続いた（`safe-commands.md` の制約が有効でなかった証拠）。
> 「ファイルを参照すること」と「ルールが判断の瞬間に機能すること」は別の問題である。

---

## 🎯 5軸分解

| 軸 | 内容 |
|---|---|
| Target | AIが人間の言及なしに、メタルール（MR-01〜09）をセッション中の判断に自律的・継続的に適用できる状態 |
| Core Tension | 「コンテキストに追加する（知識）」≠「判断の瞬間に発動する（実践）」。この2つは根本的に異なる問題 |
| Risk | GEMINI.md参照追加という「見た目の解決」に留まり、実際の行動変容が起きない。今日のsafe-commands.mdと同じ失敗を繰り返す |
| Unknowns | LLMがコンテキスト内のルールを「いつ・どの程度の重みで」参照するか。これはブラックボックス |
| Success Criteria | ユーザーが一度も言及しなくても、AIが自分でMR違反に気づいて行動を修正していること |

---

## 👥 Debate Team

| ペルソナ | 役割 | 種別 |
|---------|------|------|
| Skeptic | 全ての結論に「なぜ？」を繰り返す。証拠のない主張を即座に排除 | 固定 |
| Devil's Advocate | 採用されそうな案に必ず反論する。別の実現手段を提示 | 固定 |
| Cognitive Architect | LLMの推論・Attention機構・コンテキスト処理の観点から設計を問い直す | テーマ連動 |

---

## 📁 Round Log

| Round | ファイル | 論点 | 判定 |
|-------|---------|------|------|
| 01 | round_01.md | 「参照追加」は必要条件か必要十分条件か？ safe-commands.mdの失敗から問い直す | TBD |
| 02 | round_02.md | TBD | TBD |
| 03 | round_03.md | TBD | TBD |
