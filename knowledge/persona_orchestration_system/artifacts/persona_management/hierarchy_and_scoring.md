# Persona Management: Hierarchy, Scoring, and Growth

## 1. Persona Hierarchy (ランク制度)
ペルソナの信頼性と実績を以下のランクで管理する。

| Rank | 条件 | 扱い |
|------|------|------|
| **Ad-hoc** | 初登場（即席生成） | 保存なし（プロンプト内） |
| **Intern** | 1回以上採用 | `personas/intern/` に永続化 |
| **Regular** | 累計5回以上採用 | `personas/regular/` |
| **Core** | 累計15回採用 + 高評価 | `personas/core/` (デフォルト参加) |
| **Emeritus** | 引退 / 非推奨 | `personas/graveyard/` |

## 2. Scoring System (貢献度評価)
ディベート中の指摘が最終結果にどのように寄与したかを定量化する。

| アクション | スコア |
|-----------|-------|
| 指摘が最終稿に採用 | +2 |
| 比喩・具体例（Signature Move）が採用 | +3 |
| 大幅な構成変更への寄与 | +5 |
| ユーザーの明示的称賛 | +10 |
| 指摘がスルー（黙殺） | -1 |
| ユーザーによる拒絶 | -20 (即解雇 / 降格) |

## 3. Growth & Mutation (進化と突然変異)
- **Growth Log**: Session Reflection を通じて「何が有効だったか」をペルソナ毎に記録。
- **Signature Move Discovery**: 3回以上成功したパターン（例：特定の比喩法）を `Signature Moves` に昇格。
- **Mutation**: Core ランクのペルソナから、視点を少し変えた「派生ペルソナ」を生成（例：Skeptic → Devil's Advocate）。

## 4. Maintenance (自然淘汰)
- **Cull**: 3回連続で採用ゼロ、またはユーザーの解雇宣告により `graveyard/` へ移動。
- **Cross-Pollination**: 高評価ペルソナの成功手法を、類似分野の他ペルソナに移植する。
