# 安全コマンドホワイトリスト & 防弾プロトコル

---

## 🚨 HANG / FREEZE 即時脱出プロトコル（最優先ルール）

> [!IMPORTANT]
> **コマンドの文脈（内容・対象）に応じてハングを動的に判定せよ（MR-01）。数秒で終わるはずの処理が終わらないなら待たずに即脱出せよ。**

### フェーズ1: 検知（文脈ベースの動的ルール）
- `command_status` で `RUNNING` + `No output` が**本来予想される完了時間を超過した** → **ハング確定**
  - 例1: `ls` や `cat` は1秒未満。数秒応答がなければ即ハング判定。
  - 例2: `git push` は数秒〜10秒。
  - 例3: `npm install` や `build` は数分かかる場合があるため、出力の流れ（stagnation）で判定。
- 「もう少し待てば返るかも」という思考は禁止。完了時間を過ぎたら必ず次フェーズへ進む

### フェーズ2: 即時脱出
```
1. send_command_input(Terminate=true) でキャンセル
2. 原因を1行で診断（auth? network? blocking prompt?）
3. 代替手段に即切り替える
```

### フェーズ3: 代替手段マトリクス

| ハング原因 | 代替手段 |
|-----------|-----------|
| git push がブロック | `GIT_TERMINAL_PROMPT=0 git push` で再実行（prompt待ちを排除）|
| git push が通らない | GitHub MCP `mcp_github_push_files` で API 経由プッシュ |
| MCP が `Bad credentials` | ローカル git に切り替え。`mcp_config.json` のトークンを後で別途更新 |
| ネットワーク全断 | `write_to_file` でファイル編集だけ完了させ、push は後回し |
| ターミナル全滅 | `view_file` / `write_to_file` / GitHub MCP のみで完結させる（Layer 3）|
| APIキー・Token入力待ち | コマンドをTerminateし、`browser_subagent` で対象サービスからKeyを取得・再設定する（MR-10）|

> [!NOTE]
> **視野を広く保つ原則**: ハングしたツール1本に固執しない。「別のツールで同じゴールに到達できるか？」を常に問え。

---

## 🌐 ブラウザサブエージェント専用ルール（H-03対策）

> [!IMPORTANT]
> **ブラウザサブエージェントはターミナルと異なり watchdog が存在しない。以下のルールを必ず守れ。**

### 積極利用ルール（New!）
> [!IMPORTANT]
> **MCPやCLIで操作可能な領域を出た場合（未対応API、GUI専用設定など）は、ためらわずに `browser_subagent` を起動してブラウザ操作をガンガン実行せよ。**
> ターミナルでCURLの構文を試行錯誤して時間を浪費するより、ブラウザで直接ボタンを押す方が速く確実な場合は、GUI操作を優先すること。

### 失敗検知と切り替えルール
| 条件 | アクション |
|------|----------|
| 同じ操作を **3回** 試みて失敗 | **即座に別アプローチに切り替える** |
| MFA壁 / ログイン要求に遭遇 | ブラウザを諦め、API/MCP/CLI に切り替える |
| ページ構造変化で要素が見つからない | Raw APIエディタ / curlへ切り替える |
| 通常の描画時間を超過し応答しない | サブエージェントをキャンセルして報告する |

### 切り替え後アクション（INC-003 対策）

> [!IMPORTANT]
> **切り替えた後に「何もしない」は禁止。必ず以下の代替手段で目的を達成せよ。**

| 切り替えトリガー | 代替手段 | 具体例 |
|----------------|---------|--------|
| MFA壁 / ログイン要求 | MCP / CLI | `mcp_github_*` / Supabase MCP / `railway login --browserless` |
| セレクタ3回失敗 | Raw API (curl) | `curl -X POST https://api.supabase.com/...` を直接叩く |
| 描画スタック（ハング）| スキップ + 記録 | `incidents.md` に記録し、次タスクへ進む |
| UI構造変化 | APIドキュメント参照 | サービスの公式API/CLIに切り替えて同じ操作を実行 |

### 禁止パターン
```
❌ 同じXPathやセレクタを4回以上リトライする
❌ 「少し待てば読み込まれるかも」と5秒以上待機を繰り返す
❌ ブラウザスタックを incidents.md に報告せず黙って諦める
```

### インシデント記録義務
- ブラウザサブエージェントが3回失敗した場合 → 必ず `incidents.md` に記録する
- 記録フォーマット: `INC-XXX [OPEN] ブラウザ: [サービス名] で [操作] がスタック`

### C型ハング専用対処（Notion / Railway SaaS UIスタック）

> [!CAUTION]
> **C型ハング = 外部API依存型**。watchdogがkillしてもSaaS側のセッションは生き続ける。再試行すると二重操作になる。

| サービス | よくあるC型ハング | 対処手段 |
|---------|---------------|---------|
| **Notion** | ページUI描画がブロック / ブロック追加が反応しない | ブラウザSA諦め → `auth_notion.js` + Notion API (`fetch_notion_page.js`) で直接操作 |
| **Railway** | デプロイ画面でspinnerが止まらない / ログストリームが詰まる | ブラウザSA諦め → `railway up --detach` CLIで非同期デプロイ |
| **Vercel** | Build logsが固まる | `vercel deploy --prod` CLIで実行 |
| **Supabase** | SQL editorが応答しない | Supabase MCP `mcp_supabase_*` で直接クエリ実行 |

**再試行禁止パターン**:
```
❌ 画面が固まったままリロードして同一操作を再実行（二重操作リスク）
❌ 「少し待てば描画されるかも」と60秒以上の無操作待機
❌ browser_subagentを連続2回投入（同じUIスタックで詰まり続ける）
```

**APIフォールバック手順**:
1. ブラウザSAがスタック（応答なし） → キャンセル
2. 対象サービスのAPI/CLI代替を確認（上表）
3. API/CLI代替で同じ操作を実行
4. `incidents.md` に `INC-XXX [OPEN] C型ハング: [サービス名] UIスタック` で記録

---

## 🔬 checkout ハング根本原因（/debate deep で確定済み）

> [!CAUTION]
> 以下の3つが今回のハングの真因。同じパターンを絶対に繰り返すな。

### 根本原因1: checkout.md を使わずに独自コマンドを再実装した（最重要）

`checkout.md` には 90秒 watchdog・stall 検知・リトライロジックが内蔵されている。これを使わずに自前でチェーンコマンドを書いた結果、これらの保護が全て消えた。

**禁止**:
```bash
# ❌ checkout ロジックを自前で再実装してはいけない
cd ~/.antigravity && git add ... && git push ...
```

**正解**: checkout.md の bash スクリプトを `bash checkout.md` で実行するか、それが難しければ個別ステップを分離して実行する。

### 根本原因2: `2>&1 | tail -N` パイプが stdout をバッファして完了シグナルを隠した

git push の出力を `| tail -3` に流すと、push が完了してもパイプバッファが flush されるまで `tail` がブロックし続ける。

**禁止**:
```bash
# ❌ git push の出力をパイプで飲み込むな
GIT_TERMINAL_PROMPT=0 git push origin main 2>&1 | tail -3
```

**正解**:
```bash
# ✅ 出力はそのまま流す
GIT_TERMINAL_PROMPT=0 git push origin main --no-verify 2>&1
```

### 根本原因3: terminate 後に git lock が残ったまま次の git 操作を実行した

**必須手順**: git 操作の前に lock クリーンアップを挟む
```bash
rm -f ~/.antigravity/.git/index.lock 2>/dev/null
```

---

## 🛡️ Kinetic Command Rules
単発の静的コマンドは禁止。必ず連鎖コマンドを使用。

| ルール | ❌ 禁止 | ✅ 正解 |
|--------|---------|--------|
| Self-Healing | `python main.py` | `(lsof -ti:8000 \| xargs kill -9 2>/dev/null \|\| true) && python main.py` |
| 検証付き | `rm file.txt` | `rm file.txt && ! ls file.txt` |

---

## 許可コマンド (SafeToAutoRun: true)

**読み取り専用**: `ls`, `cat`, `head`, `tail`, `grep`, `find`, `fd`, `df -h`, `du -sh`, `pwd`, `which`, `echo`, `lsof`
**ビルド・テスト**: `pnpm lint/test`, `vitest`, `tsc --noEmit`
**パッケージ確認**: `pnpm list`, `npm list`

## 🚫 ターミナル使用前の判断フロー（最重要ルール）

> [!CAUTION]
> **ターミナルはハングの最大の原因**。`run_command` を使う前に必ず以下の判断フローを通せ。

### 判断フロー（毎回必須 — `run_command` の前に必ず通せ）

```
やりたいこと
  → 1. ネイティブツールで可能？ → YES → 使え（終了）100%ハングしない
  → 2. MCPで可能？             → YES → 使え（終了）100%ハングしない
  → 3. ブラウザで可能？         → YES → 使え（終了）100%ハングしない
  → 4. 専用CLIが存在する？      → YES → 使え（終了）タイムアウト付きで安全
     → 持ってない？ → search_web/read_url_content/browser_subagentでリサーチ → インストール → 使え
  → 5. 上記全て不可             → ターミナル使用OK（防御付き）
```

> [!CAUTION]
> **ステップ1〜4を飛ばしてステップ5に行くな。ハングしない方法は山ほどある。思考停止するな。**

### ハングしない手段の代替マトリクス

| やりたいこと | ❌ 生ターミナル | ✅ 1. ネイティブツール | ✅ 2. MCP | ✅ 3. ブラウザ | ✅ 4. CLI |
|------------|---------------|---------------------|----------|-------------|----------|
| ファイル読み取り | `cat`, `tail` | `view_file` | — | — | — |
| ファイル検索 | `find`, `grep` | `find_by_name`, `grep_search` | — | — | — |
| ファイル作成/編集 | `sed`, `echo >` | `write_to_file`, `replace_file_content` | — | — | — |
| ファイルコピー | `cp`, `rsync` | `view_file` → `write_to_file` | — | — | — |
| Git push | `git push` | — | `mcp_github_push_files` | — | `gh` CLI |
| Git操作全般 | `git` | — | `mcp_github_*` | GitHub UI | `gh` CLI |
| Web取得 | `curl`, `wget` | `read_url_content` | — | `browser_subagent` | — |
| API操作 | `curl -X POST` | — | MCP ツール群 | `browser_subagent` | 各サービスCLI |
| デプロイ | 生コマンド | — | — | ダッシュボード | `railway`, `vercel`, `fly` CLI |
| DB操作 | `psql` 直打ち | — | `mcp_supabase_*` | Supabase UI | `supabase` CLI |
| パッケージ管理 | — | — | — | — | `brew`, `pnpm` |

> [!IMPORTANT]
> **「ターミナルの方が速い」は幻想**。ハングして数分ロスする方がはるかに遅い。
> **CLIが無い？** → `search_web` でリサーチ → `browser_subagent` でインストール手順確認 → インストール → 使え。道具がないなら作れ/探せ。

## 🚫 ファイル操作のネイティブツール強制 (I/O Hang 防御)

> [!CAUTION]
> ターミナルコマンドによるファイル操作はI/Oブロック（D状態）でシステムハングを引き起こす最大の原因です。

1. **ターミナルでのファイル操作禁止**: `cp`, `rsync`, `sed`, `mkdir` 等を用いたファイル作成・コピー・移動・置換を**原則禁止**とします。
2. **ファイル読み取りもネイティブツール優先**: `cat`, `head`, `tail`, `less` より `view_file` を使え。メモリ圧迫時は `cat` すらハングする。
3. **LLMネイティブツールの優先**: 必ずエージェントのネイティブツール（`write_to_file`, `replace_file_content`, `multi_replace_file_content`）を使用してください。ディレクトリ作成もツールが自動で行います。
4. **`Cwd` パラメータの強制**: `run_command` の `CommandLine` 内で `cd` を直接実行してはいけません。必ずツールの `Cwd` パラメータでカレントディレクトリを指定してください。

## 🔒 Git Safety Rules（Grounding原則）

**git操作前に必ず以下を実行する（省略禁止）**:

```bash
git rev-parse --show-toplevel 2>&1  # このディレクトリがgit管理下か確認
git remote -v 2>&1                  # remoteが存在するか確認
```

remoteが存在しない → push禁止。`ENVIRONMENTS.md` を参照して正しいパスを確認すること。

**git push は必ず以下の形式で実行する（省略禁止）**:
```bash
GIT_TERMINAL_PROMPT=0 git push origin [branch] --no-verify
```

| ルール | 説明 |
|--------|------|
| プロジェクトバウンダリ | `git add/commit/push` 前に上記Grounding確認を必須実行 |
| 1タスク=1プロジェクト | 複数プロジェクトにまたがるgit操作禁止 |
| remote未設定 = push禁止 | `git remote -v` が空 → pushしない、`ENVIRONMENTS.md` で正しいパスを探す |

## 禁止コマンド
- `--dangerously-skip-permissions`
- `rm -rf /` 系
- 本番への直接デプロイ（`/deploy` WF経由必須）

## ⏱️ Timeout Guard & Async Polling Protocol (3-Layer Defense)

> [!IMPORTANT]
> 「長時間タスクをそのまま直列で実行して待機する」ことは禁止です。

1. **非同期実行の徹底**: `npm install`, ビルド, デプロイなどの長時間プロセスを実行する際は、`WaitMsBeforeAsync` を低め（1000ms〜3000ms）に設定し、**即座にバックグラウンドへ送り `command_status` ツールでポーリング**してください。

```
Layer 1: GIT_TERMINAL_PROMPT=0 付き実行  (credential prompt ハング対策)
Layer 2: run_command(WaitMsBeforeAsync=必要最小限) → Background → 定期的に command_status で監視
Layer 3: write_to_file / replace_file_content でI/Oブロックのターミナル迂回
Layer 4: Token/Key入力ブロックによるハング時は `browser_subagent` を起動し自律的に認証情報を取得（MR-10）
```

| 操作 | リスク | Layer |
|------|--------|-------|
| git push (HTTPS) | 中（credential待ちハング） | 1 |
| 小ファイルcp/mv | 低 | 1 |
| rm -rf（ディレクトリ） | 高 | 2 |
| 大量ファイルコピー | 中 | 1→2 |
| ターミナル全滅 | 最高 | 3 |
| CLIでのトークン要求 | 中 | 4 (MR-10) |

---

## 🧠 根本原因5: メモリ圧迫時は全I/Oが危険（2026-02-28 追加）

> [!CAUTION]
> **SWAP圧迫状態では `ls`, `cat`, `ps` レベルの基本コマンドすらハングする。**
> ディスクI/O = メモリ回収待ち → カーネルレベルのページフォルト連鎖。
> 「コマンドが簡単だから大丈夫」は誤り。全I/Oが危険。

### メモリ圧迫検知ルール

| 条件 | 判定 |
|------|------|
| `ls` / `cat` / `echo` が2秒以内に完了しない | **メモリ圧迫確定** |
| 連続2回のコマンドがユーザーにキャンセルされた | **メモリ圧迫確定** |
| `run_command` が RUNNING + No output で10秒超過 | **メモリ圧迫の疑い** |

### メモリ圧迫時フォールバックプロトコル

```
検知 → ターミナル使用即中止 → 以下のツールのみで作業続行:

1. view_file / view_file_outline / view_code_item  — ファイル読み取り
2. grep_search / find_by_name                       — 検索
3. write_to_file / replace_file_content             — ファイル書き込み
4. mcp_github_* (push_files, create_or_update_file) — git操作
5. read_url_content                                  — Web取得

❌ 絶対に使わない: run_command, send_command_input, command_status
```

### コマンド発行パターンルール

| ❌ 禁止パターン | ✅ 正解 |
|---------------|---------|
| 1つの`run_command`で10行スクリプト | **1コマンド1行に分離** |
| `cp A && cp B && cp C` チェーン | 各 `cp` を別の `run_command` |
| `cat file \| tail -N` パイプ | `tail -N file` (パイプ不使用) |
| `git add && git commit` | `git add` → 完了確認 → `git commit` |
| ディスクI/O3連続 | **2回連続キャンセル → フォールバック発動** |

---

## 📂 環境参照

4種ディレクトリの役割・禁止操作 → [`ENVIRONMENTS.md`](../ENVIRONMENTS.md) を参照

