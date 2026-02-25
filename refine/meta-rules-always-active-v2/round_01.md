# Round 01: 「参照追加」は必要条件か必要十分条件か？safe-commands.mdの失敗から問い直す

**日時**: 2026-02-24T19:48 JST
**前ラウンドからの焦点**: 初回。Knowledge Injectionで判明した核心的証拠から議論を開始する。

**証拠（Evidence baseline）**:
- `GEMINI.md` は `safe-commands.md` を2ヶ月以上参照している
- 今日 2026-02-24、`rsync -a agent/skills/` がI/Oブロックで2時間以上停止した
- これは「参照されているルールが守られなかった」実例である

---

## 議論

**🤔 Skeptic**:

「GEMINI.mdにDECISION_USECASES.mdへの参照を追加する」という案を最初に聞いたとき、私は以下を問う。

**safe-commands.mdで何が起きたか？**

`safe-commands.md` はGEMINI.mdに参照されている。内容は「タイムアウト×秒以上はkillせよ」などのルールを含む。にもかかわらず今日、`rsync -a agent/skills/` が2時間以上ブロックし続けた。AIはそれを止めなかった。

これは偶発ではない。**「参照されているルールが判断の瞬間に機能する」という前提が崩れている**。

ならばDECISION_USECASES.mdをGEMINI.mdに参照追加しても、safe-commands.mdと同じ運命を辿る。**なぜ今回は異なると言えるのか？**

この問いに答えられなければ、GEMINI.md参照追加は「何かした感」を生み出すだけで問題を解決しない。

---

**😈 Devil's Advocate**:

Skepticの指摘は鋭いが、結論が早すぎる。

safe-commands.mdの失敗を分析しよう。なぜ機能しなかったか？おそらく以下のいずれかだ：

1. **トリガーがなかった**: `rsync` を実行した瞬間、AIはそれがI/Oブロックを引き起こすとは知らなかった（事前の知識がなかった）
2. **コンテキスト内での存在感が低かった**: safe-commands.mdは参照されているが、実際のコンテキストウィンドウには読み込まれていない可能性がある

**Skepticへの反論**: DECISION_USECASES.mdの場合は、Case 13（「早く間違えてリカバリー」）やCase 08（「迷ったら掘る」）のような**判断のパターン**が含まれる。これはルール（「○秒でkill」）とは異なり、**判断の文脈**そのものだ。

しかし同時に**自分の主張を崩す事実**も認める:
Cognitive ArchitectはLLMのattention mechanismを理解しているはずだ。コンテキストの「中段」にある参照（ファイル名のみ）は、コンテキスト後半の具体的な記述より注意重みが低い。ファイル名を書いても実際に読み込まなければ意味がない。

**問いをCognitive Architectに投げる**: LLMはGEMINI.md内の「参照リンク」を見たとき、実際にそのファイルの内容を推論に使うのか？

---

**🏗️ Cognitive Architect**:

Devil's Advocateの問いに直接答える。

**LLMはリンクされたファイルを自動的に読まない。**

GEMINI.mdに `~/.antigravity/agent/rules/safe-commands.md` と書いてあっても、それはファイルへの**ポインタ**に過ぎない。LLMがそのポインタを「意味ある参照」として扱うのは、：
1. そのファイルがコンテキストウィンドウに実際に読み込まれているとき
2. または、checkinや他の仕組みによって内容が注入されているとき

**根本的な問い**: Antigravityのアーキテクチャにおいて、GEMINI.mdの「参照」は誰が解決するのか？

- `code-standards.md` はcheckinで読み込まれているか？ → 確認できていない
- 現在のcheckinはNEXT_SESSION.mdを読む（本日追加）。しかし DECISION_USECASES.md は読まない

**構造的な発見**: safe-commands.mdが機能しなかったのは、おそらく**コンテキストに実体として存在していなかったから**だ。DECISION_USECASES.mdをGEMINI.mdに参照追加しても、実体としてコンテキストに読み込まれなければ同じ結果になる。

**より根本的な問い（Skepticへ）**: 「判断の瞬間にルールが機能する」条件とは何か？コンテキストへの読み込みだけで十分か？それとも、判断の **直前に** ルールが参照される構造が必要か？

---

## 🧭 Moderator Summary

| 項目 | 内容 |
|------|------|
| 明確になったこと（Evidence確認済み） | 「GEMINI.mdへの参照追加 ≠ コンテキストへの実体読み込み」。LLMはリンクを自動解決しない |
| 明確になったこと | safe-commands.mdが機能しなかった真の理由：コンテキストに実体として存在していなかった可能性が高い |
| 明確になったこと | DECISION_USECASES.mdをGEMINI.mdに参照するだけでは**safe-commands.mdと同じ失敗**を繰り返す |
| まだ詰まっていない論点 | checkinでDECISION_USECASES.mdの実体をコンテキストに読み込めば機能するか？（Layer 1の正しい実装） |
| まだ詰まっていない論点 | 読み込んでも「判断の瞬間」に近いところになければ機能しないか？（Attention分散問題） |
| まだ詰まっていない論点 | 10KB（DECISION_USECASES.md全文）を毎回読み込むコストと効果のトレードオフ |
| **判定** | `Deep Dive` — 「checkinで実体を読む」設計の限界と、判断の瞬間に近い通知の設計を次ラウンドで掘る |
