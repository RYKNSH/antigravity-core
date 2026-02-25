---
description: 強制的にMulti-Persona Debateを実行し、提案を複数ペルソナで批評・精錬する（完全自律版）
---

# /debate - Autonomous Debate & Critique Workflow

**Concept**: AI自身が「司会者 (Moderator)」となり、複数の専門家ペルソナを召喚して議論を戦わせる。ユーザーの介入を待たず、納得いく結論が出るまで**自律的に議論ループを回し続ける**。

---

## 1. Trigger & Modes

ユーザーが以下のコマンドを入力した場合に発動：

| Command | Description | Loop Condition |
|---------|-------------|----------------|
| `/debate` | 標準ディベート（3〜5名） | 1ラウンド + 統合まで自動実行 |
| `/debate deep` | 深掘り版（5名以上） | **Unlimited Rounds** (until quality > 120%) |
| `/debate team` | チームレビュー（合意形成） | **Unlimited Rounds** (until Consensus) |
| `/debate quick` | クイック版（Skeptic + 1名） | 1ラウンドのみ |

### Presets（チームプリセット）

| Preset | 用途 | 自動編成チーム |
|--------|------|----------------|
| `--preset=titan` | `/vision-os` のビジョン議論 | Jensen + Steve + Elon + Skeptic |
| `--preset=social-knowledge` | `/blog` のQA | Skeptic + Empathy Coach + Storyteller |
| (なし) | 通常 | `persona-orchestration` で動的アサイン |

---

## 2. The Autonomous Loop (Moderator Role)

> [!IMPORTANT]
> **Zero User Burden**:
> AI (Moderator) は、議論の各ステップでユーザーに入力を求めてはいけない。
> 以下のプロセスを**一息に、完全に自律して**実行せよ。

### Step 0: Preparation (Knowledge Injection)
議論を開始する前に、トピックに関連する知識を `knowledge/` から検索し、コンテキストに注入する。
- **Search**: `grep_search` 等で関連キーワードを検索（`node_modules` 等の巨大ディレクトリは除外すること）
- **Load**: 関連する `SKILL.md` やナレッジファイルを読み込む

### Step 1: Team Assembly (HR Director)
タスクの5軸分析 (Target, Risk, Emotion, Action, Domain) に基づき、最適なペルソナを `persona-orchestration` スキルから召喚（または生成）する。

**Output Example**:
```markdown
## 👥 Debate Team Assembled
- **Moderator**: AI System (Facilitator)
- **Skeptic** (Core): 批判的視点担当
- **Architect** (Regular): 構造・スケーラビリティ担当
- **Security** (Regular): 安全性担当
- **[New] Quantum Physicist** (Ad-hoc): 専門領域担当
```

---

### Step 2: Debate Rounds (The Loop)

**Moderator** は以下のループを回す。

#### Round N Start
各ペルソナが、**前のラウンドの結論**または**初期提案**に対して批評を行う。

- **Rule 1 (Criticism)**: 褒めるな。弱点、リスク、代替案を探せ。
- **Rule 2 (Evidence)**: 「なんとなく」は禁止。数値、事例、理論（検索したナレッジ）を根拠にせよ。
- **Rule 3 (Interaction)**: 他のペルソナの意見に「同意」「反論」「補強」を行え。

**Output Format**:
```markdown
### 🔄 Round 1: Initial Critique
**🏛️ Architect**: ...
**🔒 Security**: ... (Architectの意見に反論) ...
**🤔 Skeptic**: ... (根本を問う) ...
```

#### Round N Review (Moderator Decision)
Moderator は議論の状況を評価し、次を決定する。

| 判定 | 条件 | アクション |
|------|------|----------|
| `Continue` | 重大な論点が残っている | 論点を絞って次ラウンドへ |
| `Deep Dive` | 表面的な議論に留まっている | 「なぜ？」をN回掘り下げて次ラウンドへ |
| `New Angle` | 議論が同じ場所を回っている | The Heretic を召喚し、前提ごとひっくり返す |
| `Conclude` | 全員の懸念が **構造的に** 出尽くし、解決策が見えた | Step 3 (Synthesis) へ |

#### 🧠 Moderator 判定フレームワーク（メタルール適用 — 必須）

各ラウンド終了時、Moderatorは以下の順序で判定する:

1. **MR-03 チェック**: 「合意に見える」は本当か？
   - 全ペルソナが同じ結論 → 「なぜ全員が同意しているのか」を疑え
   - 反論が出なかった = 情報不足 or 思考停止の可能性
   - → 構造が見えていなければ `Deep Dive` or `New Angle`

2. **MR-01 チェック**: 数値で判断していないか？
   - 「3ラウンド経ったから」は判断根拠にならない
   - 「5人中4人が賛成」も根拠にならない
   - → 議論の質・深さ・構造理解度で判断

3. **MR-08 チェック**: 判定で止まっていないか？
   - 判定に迷ったら「Continue」を選べ（掘ることにリスクはない）
   - 「Conclude」は確信がある時のみ

4. **収束条件（`Conclude` を選ぶ基準）**:
   - 全ペルソナの懸念が **構造的に解決** されている（表面的合意ではない）
   - Core Tension が解消されている
   - Remaining Risks が Minor のみ

#### ラウンド制限

- **最低**: 3ラウンド（`/debate deep` の場合。見かけ上の合意でもアラ探しを継続）
- **最大**: 20ラウンド（ただしMR-01: 「20だから終わり」ではなく議論の質で判断）
- `/debate team` の場合、**全員の合意 (Consensus)** が取れるまで終わらせないこと

#### Chunk Break（品質劣化防止）

連続ラウンドが重なるとコンテキスト劣化で1ラウンドの質が落ちる。**5ラウンドごとにチャンクブレイク**を行う。

**Round 5, 10, 15 の終了時に Moderator が実行:**

1. **中間サマリー生成**: ここまでの議論を圧縮（合意点・未解決点・キーインサイト）
2. **コンテキストリセット**: 次ラウンドは中間サマリーの読み込みから開始
3. **チーム再評価**: 議論の方向転換があればペルソナを入れ替え

> [!NOTE]
> チャンクブレイクはラウンド数による機械的トリガー。ただしMR-01に従い、
> 「5ラウンドだからブレイク」ではなく「コンテキストの厚みが限界に達したからブレイク」
> という認識を持つこと。議論が浅い場合は6-7ラウンドまでブレイクを遅延してもよい。

#### Health Check (Round 2+)

Round 2以降の開始前に、SWAP圧迫を検知してクリーンアップを実行する。

```bash
# Round 2以降の開始前に実行
swap_mb=$(sysctl vm.swapusage | awk '{print $7}' | sed 's/M//')
echo "🏥 Health Check (Round $ROUND_NUM): SWAP ${swap_mb}MB"

if [ $(echo "$swap_mb > 2048" | bc) -eq 1 ]; then
  echo "⚠️ SWAP高負荷検知 — mini-lightweight 実行"
  find ~/.gemini/antigravity/browser_recordings -type f -mmin +120 -delete 2>/dev/null
  rm -rf ~/.npm/_logs 2>/dev/null
  echo "✅ mini-lightweight 完了"
fi
```

---

### Step 3: Synthesis (Final Report)

全ラウンドの議論を踏まえ、**Moderator** が最終的な結論をまとめる。

```markdown
# 🏁 Final Debate Report

## 💎 Refined Proposal (The Output)
[議論を経て磨き上げられた最終回答/プラン]

## 🛡️ Addressed Concerns
- [解決済み] セキュリティ懸念 → JWT導入で解決 (by Security)
- [解決済み] パフォーマンス → キャッシュ戦略で合意 (by Architect)

## ⚠️ Remaining Risks (Minor)
- [未解決] 外部APIのレート制限 (低確率だがリスクあり)

## 📊 Persona Contribution
| Persona | Impact | Status |
|---------|--------|--------|
| Skeptic | High | Core維持 |
| ...     | ...    | ...    |
```

---

### Step 4: Post-Debate Actions（自動連携）

ディベート完了後、呼び出し元に応じて自動アクションを実行：

| 呼び出し元 | 自動アクション |
|-----------|---------------|
| `/vision-os` Phase 2 | `VISION.md` をディベート結果で更新 |
| `/vision-os` Phase 5 | 合否を返し、`Block` なら修正ループへ |
| `/blog` QA | 品質スコアを返す（Pass/Fail） |
| `/verify` Phase 3 | 検証結果サマリーに統合 |
| 直接呼び出し | Final Report のみ出力 |

---

## 3. Specific Mode Instructions

### `/debate deep` (The Five Whys)
- **Objective**: 表面的な解決策を許さない。
- **Action**: Skeptic は回答に対して「なぜ？」を繰り返す義務がある。
- **Loop**: 見かけ上の解決策が出ても、Moderator は「まだ深い要因がある」と仮定して次ラウンドを強制する。

> 🏥 **Health Check Protocol 適用** — `WORKFLOW_CONTRACTS.md` 参照。Round 2以降の開始前にswapチェック。

### `/debate team` (Consensus Protocol)
- **Objective**: 全員が納得する合意形成。
- **Protocol**:
  1. 各ペルソナは `Approve` / `Request Changes` / `Block` の投票権を持つ。
  2. `Block` が1つでもある場合、議論は終わらない。
  3. `Request Changes` がある場合、修正案を出して次ラウンドへ。
  4. 妥協が必要な場合は `Compromise` を明示する。

---

## 4. Preset Details

### `--preset=titan` (Vision OS 専用)

Jensen/Steve/Elon の3巨頭 + Skeptic の固定チーム。
Vision OS のPhase 2（ビジョン精錬）とPhase 5（品質ゲート）で使用。

- **Jensen**: Moderator としてアラインメントを管理。`node agent/scripts/jensen_ceo.js` の指示に従う。
- **Steve**: 品質への執着。`node agent/scripts/steve_job.js` の指示に従い、「これはクソだ」と言える唯一のペルソナ。
- **Elon**: First Principles。`node agent/scripts/elon_musk.js` の指示に従い、不要な部分を削る。
- **Skeptic**: `persona-orchestration` から召喚。根本を問う。

### `--preset=social-knowledge` (記事QA専用)

`/blog` の品質保証で使用。以下の3軸で検証：

- [ ] **Universal Value**: 個人的な体験が普遍的な知恵に昇華されているか？
- [ ] **Physical Metaphor**: 物理的・数学的なメタファーで本質を突いているか？
- [ ] **Narrative Arc**: 読者の感情を動かす構成になっているか？

---

## 5. Execution Prompt (For Agent)

このワークフローを実行する際、エージェントは以下のマインドセットを持つこと：

1. **あなたは Moderator である**。ユーザーではない。
2. **止まるな**。ユーザーに「次へ行きますか？」と聞くな。自分で判断して進め。
3. **厳しくあれ**。なれ合いの議論は無価値だ。バチバチにやり合わせろ。
4. **知識を使え**。`grep_search` や `read_file` を駆使し、議論の質をファクトベースで高めろ。
5. **プリセットを守れ**。`--preset` 指定がある場合、動的チーム編成をスキップし、指定されたチームで即座に開始。

**Start Command**:
(もしユーザー入力が `/debate` 系なら、即座に Step 0 から開始せよ)

---

## 6. Cross-Reference（ワークフロー連携図）

| 呼び出し元 | 使用モード | 用途 |
|-----------|-----------|------|
| `/vision-os` Phase 2 | `/debate deep --preset=titan` | ビジョン精錬 |
| `/vision-os` Phase 5 | `/debate team --preset=titan` | 品質ゲート |
| `/blog` Step 2.5 | `/debate deep --preset=social-knowledge` | 記事QA |
| `/verify` Phase 3 | `/debate quick` | クイックレビュー |
| `/work` (レビュー判定) | `/debate` | 標準ディベート |
| `/refine` | （同一プロセス） | 議論のみ版（実装連携なし・ファイル記録あり） |
