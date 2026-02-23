# 安全コマンドホワイトリスト & 防弾プロトコル

---

## 🚨 HANG / FREEZE 即時脱出プロトコル（最優先ルール）

> [!IMPORTANT]
> **コマンドが30秒以上 "No output" のままならハングと判定せよ。待つな。即脱出せよ。**

### フェーズ1: 検知（30秒ルール）
- `command_status` で30秒以上 `RUNNING` + `No output` → **ハング確定**
- 「もう少し待てば返るかも」という思考は禁止。必ず次フェーズへ進む

### フェーズ2: 即時脱出
```
1. send_command_input(Terminate=true) でキャンセル
2. 原因を1行で診断（auth? network? blocking prompt?）
3. 代替手段に即切り替える
```

### フェーズ3: 代替手段マトリクス

| ハング原因 | 代替手段 |
|-----------|---------|
| git push がブロック | `GIT_TERMINAL_PROMPT=0 git push` で再実行（prompt待ちを排除）|
| git push が通らない | GitHub MCP `mcp_github_push_files` で API 経由プッシュ |
| MCP が `Bad credentials` | ローカル git に切り替え。`mcp_config.json` のトークンを後で別途更新 |
| ネットワーク全断 | `write_to_file` でファイル編集だけ完了させ、push は後回し |
| ターミナル全滅 | `view_file` / `write_to_file` のみで完結させる（Layer 3）|

> [!NOTE]
> **視野を広く保つ原則**: ハングしたツール1本に固執しない。「別のツールで同じゴールに到達できるか？」を常に問え。

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

git push の出力を `| tail -3` に流すと、push が完了してもパイプバッファが flush されるまで `tail` がブロックし続ける。バックグラウンド実行では `No output` に見え、ハングと誤判断した。

**禁止**:
```bash
# ❌ git push の出力をパイプで飲み込むな
GIT_TERMINAL_PROMPT=0 git push origin main 2>&1 | tail -3
```

**正解**:
```bash
# ✅ 出力はそのまま流す。見たくなければリダイレクトで捨てる
GIT_TERMINAL_PROMPT=0 git push origin main --no-verify 2>&1
```

### 根本原因3: terminate 後に git lock が残ったまま次の git 操作を実行した

バックグラウンドコマンドを `Terminate=true` で強制終了した場合、`.git/index.lock` が残る。その直後に次の git 操作を走らせると lock 競合でブロックされる。

**必須手順**: git 操作の前に lock クリーンアップを挟む
```bash
# ✅ terminate 後の次回 git 操作の前に必ず実行
rm -f ~/.antigravity/.git/index.lock 2>/dev/null
```

---


## 🛡️ Kinetic Command Rules
単発の静的コマンドは禁止。必ず連鎖コマンドを使用。

| ルール | ❌ 禁止 | ✅ 正解 |
|--------|---------|--------|
| 静的cd禁止 | `cd backend` | `cd /full/path && echo "$PWD"` |
| Self-Healing | `python main.py` | `(lsof -ti:8000 \| xargs kill -9 2>/dev/null \|\| true) && python main.py` |
| 検証付き | `rm file.txt` | `rm file.txt && ! ls file.txt` |

---

## 許可コマンド (SafeToAutoRun: true)

**読み取り専用**: `ls`, `cat`, `head`, `tail`, `grep`, `find`, `fd`, `df -h`, `du -sh`, `git status/diff/log`, `pwd`, `which`, `echo`, `lsof`
**ビルド・テスト**: `pnpm lint/test`, `vitest`, `tsc --noEmit`
**パッケージ確認**: `pnpm list`, `npm list`

## 🔒 Git Safety Rules（Grounding原則）

**git操作前に必ず以下を実行する（省略禁止）**:

```bash
git rev-parse --show-toplevel 2>&1  # このディレクトリがgit管理下か確認
git remote -v 2>&1                  # remoteが存在するか確認
```

remoteが存在しない → push禁止。`~/.antigravity/incidents.md` を参照して正しいパスを確認すること。

**git push は必ず以下の形式で実行する（省略禁止）**:
```bash
GIT_TERMINAL_PROMPT=0 git push origin [branch] --no-verify
```
`GIT_TERMINAL_PROMPT=0` を省略すると、バックグラウンドでの実行時に credential prompt 待ちでハングする。

| ルール | 説明 |
|--------|------|
| プロジェクトバウンダリ | `git add/commit/push` 前に上記Grounding確認を必須実行 |
| 1タスク=1プロジェクト | 複数プロジェクトにまたがるgit操作禁止 |
| remote未設定 = push禁止 | `git remote -v` が空 → pushしない、正しいパスを探す |

## 禁止コマンド
- `--dangerously-skip-permissions`
- `rm -rf /` 系
- 本番への直接デプロイ（`/deploy` WF経由必須）
- 相対パスへの `cd`（トラブル時）

## ⏱️ Timeout Guard (3-Layer Defense)

```
Layer 1: GIT_TERMINAL_PROMPT=0 付き実行  (credential prompt ハング対策)
Layer 2: run_command(WaitMsBeforeAsync=500) → Background → 30s無出力→Terminate
Layer 3: write_to_file/view_file/MCP でターミナル迂回
```

| 操作 | リスク | Layer |
|------|--------|-------|
| git push (HTTPS) | 中（credential待ちハング） | 1 |
| 小ファイルcp/mv | 低 | 1 |
| rm -rf（ディレクトリ） | 高 | 2 |
| 大量ファイルコピー | 中 | 1→2 |
| ターミナル全滅 | 最高 | 3 |


