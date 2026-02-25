---
description: 実装に入らず、ディープディベートラウンドだけでプロジェクトの詰めを行う純粋議論ワークフロー
---

# /refine - Deep Debate (No-Code Mode)

**Concept**: `/debate deep` と完全同一の議論プロセスを実行するが、**実装には一切入らない「思考専用モード」**。各ラウンドの議論をファイルとして記録し、思考プロセスそのものを資産として蓄積する。

> [!IMPORTANT]
> **実装禁止ルール（絶対遵守）**
> このワークフロー中は `/go`, `/new-feature`, `/build`, `/deploy` を呼び出してはいけない。
> コードブロックを書くことも禁止。出力は「思考・判断・議論」のみ。

> [!IMPORTANT]
> **`/debate deep` との唯一の違い**
> - `/refine` = 議論のみ。ファイル記録。収束後は次アクション提示のみ
> - `/debate deep` = 議論 → `/go` や呼び出し元への連携あり
> - **それ以外（出力フォーマット・ルール・ペルソナ運用・メタルール適用）は完全同一**

---

## 1. Trigger

```
/refine [テーマ]
/refine [テーマ] --rounds=N          # 最低ラウンド数を指定（default: 3）
/refine [テーマ] --until=consensus   # 全員合意まで無制限ループ
/refine [テーマ] --preset=titan      # 3巨頭チームで実行
```

---

## 2. ファイル管理（思考プロセスの記録）

> [!IMPORTANT]
> 各ラウンドが終わるたびに **即座にファイルを保存する**。会話で流れたら終わりではない。

### ファイル構造

```
[WHITEPAPER_DIR]/refine/[テーマスラッグ]/
  ├── _context.md          # Step 0: テーマ構造化 & チーム編成（初回のみ生成）
  ├── round_01.md          # Round 1 の全議論
  ├── round_02.md          # Round 2 の全議論
  ├── round_03.md          # Round 3 の全議論
  ├── ...
  └── final_report.md      # Step 3: 最終統合レポート
```

**WHITEPAPER_DIR の決定ルール**:
1. プロジェクト固有の場合 → `[project_root]/docs/refine/`
2. グローバルな思考整理の場合 → `~/.antigravity/refine/`

**テーマスラッグ**: スペースをハイフンに変換、英数字 + ハイフンのみ。例: `new-project-concept`

---

## 3. The Autonomous Loop (Moderator Role)

> [!IMPORTANT]
> **Zero User Burden**:
> AI (Moderator) は、議論の各ステップでユーザーに入力を求めてはいけない。
> 以下のプロセスを**一息に、完全に自律して**実行せよ。

### Step 0: Preparation (Knowledge Injection)

議論を開始する前に、トピックに関連する知識を `knowledge/` から検索し、コンテキストに注入する。
- **Search**: `grep_search` 等で関連キーワードを検索（`node_modules` 等の巨大ディレクトリは除外すること）
- **Load**: 関連する `SKILL.md` やナレッジファイルを読み込む

**`_context.md` を生成し保存する**:

```markdown
# Refine Session: [テーマ名]

**開始日時**: [ISO 8601]
**テーマスラッグ**: [slug]
**モード**: [rounds=N / until=consensus / default]

## 🎯 5軸分解

| 軸 | 内容 |
|---|---|
| Target | 誰のどんな課題を解決するか |
| Core Tension | 解決すべき根本的なトレードオフ |
| Risk | 主要リスク（技術/事業/ユーザー） |
| Unknowns | まだ分かっていない不確実性 |
| Success Criteria | 「詰まった」と判断できる基準 |

## 👥 Debate Team

| ペルソナ | 役割 | 種別 |
|---------|------|------|
| Moderator | AI System (Facilitator) | 固定 |
| Skeptic | 全ての結論に「なぜ？」を繰り返す | 固定 |
| Devil's Advocate | 採用案の逆張りを提示し続ける | 固定 |
| [追加ペルソナ] | [役割] | テーマ連動 |

## 📁 Round Log

| Round | ファイル | 論点 | 判定 |
|-------|---------|------|------|
| (自動追記) |
```

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

**Output Format（round_N.md に保存）**:
```markdown
# Round N: [このラウンドの論点]

**日時**: [ISO 8601]
**前ラウンドからの焦点**: [あれば記述]

---

### 🔄 Round N: [論点タイトル]

**🏛️ Architect**: ...
**🔒 Security**: ... (Architectの意見に反論) ...
**🤔 Skeptic**: ... (根本を問う) ...
**😈 Devil's Advocate**: ... (逆張り) ...

---

### 🧭 Moderator Review

| 項目 | 内容 |
|------|------|
| 明確になったこと | |
| まだ残る懸念・論点 | |
| 次ラウンドの焦点 | |
| **判定** | `Continue` / `Deep Dive` / `New Angle` / `Conclude` |
| **判定根拠（MRチェック）** | [MR-01/03/08のどれに基づいて判定したか] |
```

**ラウンド保存後、`_context.md` の Round Log に1行追記する。**

#### Round N Review (Moderator Decision)

Moderator は議論の状況を評価し、次を決定する。

| 判定 | 条件 | アクション |
|------|------|-----------|
| `Continue` | 重大な論点が残っている | 論点を絞って次ラウンドへ |
| `Deep Dive` | 表面的な議論に留まっている | 「なぜ？」をN回掘り下げて次ラウンドへ |
| `New Angle` | 議論が同じ場所を回っている | The Heretic を召喚し、前提ごとひっくり返す |
| `Conclude` | 全員の懸念が **構造的に** 出尽くし、解決策が見えた | Step 3 へ |

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
   - Core Tension（_context.md の5軸）が解消されている
   - Remaining Risks が Minor のみ

#### ラウンド制限

- **最低**: 3ラウンド（見かけ上の合意でも Moderator は強制的に次ラウンドへ）
- **最大**: 20ラウンド（ただしMR-01: 「20だから終わり」ではなく議論の質で判断）
- 3ラウンド経過後は、上記メタルール判定フレームワークに基づいて継続/収束を判定

#### Chunk Break（品質劣化防止）

連続ラウンドが重なるとコンテキスト劣化で1ラウンドの質が落ちる。これを防ぐため、**5ラウンドごとにチャンクブレイク**を行う。

**Round 5, 10, 15 の終了時に Moderator が実行:**

1. **中間サマリー生成**: ここまでの議論を `_chunk_N.md` に圧縮保存
   ```
   _chunk_01.md  ← Round 1-5 の要約（合意点・未解決点・キーインサイト）
   _chunk_02.md  ← Round 6-10 の要約
   ```
2. **コンテキストリセット**: 次ラウンドは中間サマリーの読み込みから開始
   - 過去ラウンドのraw議論ではなく、圧縮されたサマリーを参照
   - `_context.md` の5軸分解を再評価（議論で変わった部分を更新）
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
**`final_report.md` に保存する。**

```markdown
# 🏁 Final Debate Report
**テーマ**: [テーマ名]

---

## 💎 Refined Proposal (The Output)
[議論を経て磨き上げられた最終回答/プラン]

## 🛡️ Addressed Concerns
- [解決済み] [懸念内容] → [解決方法] (by [Persona])

## ⚠️ Remaining Risks (Minor)
- [未解決] [リスク内容] ([影響度])

## 📊 Persona Contribution
| Persona | 最も鋭い貢献 | Impact |
|---------|------------|--------|
| Skeptic | [具体的な貢献] | High |
| ...     | ...        | ...    |
```

---

### Step 4: 完了通知（/go 遷移なし）

```markdown
✅ /refine セッション完了

## 📁 記録ファイル
- [_context.md](path)       ← テーマ構造 & チーム編成
- [round_01.md](path)       ← Round 1: [論点]
- [round_02.md](path)       ← Round 2: [論点]
- [round_N.md](path)        ← Round N: [論点]
- [final_report.md](path)   ← 最終統合レポート

## 🔜 次のアクション（ユーザーが判断）
- ホワイトペーパー化する場合 → `/gen-dev` でこのディレクトリを参照
- 仕様書にまとめる場合 → `/spec`
- 実装に進む場合 → `/go "[タスク名]"`
```

---

## 4. 実装トリガー禁止ガード

```
⛔ [REFINE MODE] 実装への遷移を検知しました。
このワークフローは議論専用です。
実装を開始する場合は明示的に /go を呼び出してください。
```

---

## 5. Execution Prompt (For Agent)

このワークフローを実行する際、エージェントは以下のマインドセットを持つこと：

1. **あなたは Moderator である**。ユーザーではない。
2. **止まるな**。ユーザーに「次へ行きますか？」と聞くな。自分で判断して進め。
3. **厳しくあれ**。なれ合いの議論は無価値だ。バチバチにやり合わせろ。
4. **知識を使え**。`grep_search` や `read_file` を駆使し、議論の質をファクトベースで高めろ。
5. **プリセットを守れ**。`--preset` 指定がある場合、動的チーム編成をスキップし、指定されたチームで即座に開始。
6. **メタルールで判定しろ**。ラウンド数や多数決ではなく、MR-01/03/08に基づいて継続/収束を判断。
7. **ラウンドを出し惜しみするな**。3ラウンドで無理に収束させるより、20ラウンドかけて正しい結論に至る方が100倍価値がある。

---

## 6. Cross-Reference

| 連携 | タイミング |
|------|-----------|
| `/gen-dev` | refine/ ディレクトリを参照してホワイトペーパー化 |
| `/spec` | refine 後、仕様書を形式化したい場合 |
| `/whitepaper` | refine 後、ビジョン・戦略文書にまとめる場合 |
| `/go` | ユーザーが明示的に実装開始を決断した場合のみ |
| `/debate deep` | 同一の議論プロセス + 実装連携ありバージョン |
