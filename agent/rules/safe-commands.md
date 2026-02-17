# 安全コマンドホワイトリスト & 防弾プロトコル

# 安全コマンドホワイトリスト & Kinetic Protocol

## 🛡️ Kinetic Command Rules (Physics-Based)
単発の静的コマンド(Static Command)は禁止。必ず運動量(Momentum)を持つ連鎖コマンドを使用せよ。

### 1. Law of Inertia (Stop Static `cd`)
- ❌ `cd backend` (慣性なし、即停止)
- ✅ `cd /Volumes/SSD/.../backend && echo "Context: $PWD"` (質量あり)

### 2. Conservation of Momentum (Self-Healing)
- ❌ `python main.py` (衝突で停止)
- ✅ `(lsof -ti:8000 | xargs kill -9 2>/dev/null || true) && python main.py` (障害物を破壊して進む)

### 3. Action & Reaction (Verification)
- ❌ `rm file.txt` (作用のみ)
- ✅ `rm file.txt && ! ls file.txt` (作用と反作用の確認)

---

## 許可されたコマンド (SafeToAutoRun: true)

## 読み取り専用コマンド
- `ls`, `cat`, `head`, `tail`, `grep`, `find`, `fd`
- `df -h`, `du -sh`, `sysctl vm.swapusage`
- `git status`, `git diff`, `git log`
- `pwd`, `which`, `echo`
- `lsof` (プロセス確認用)

## ビルド・テスト（破壊的でない）
- `pnpm lint`, `pnpm typecheck`, `npm run lint`
- `pnpm test`, `vitest`, `npm test`（非CI環境）
- `tsc --noEmit`

## 開発サーバー (Bulletproof Only)
- アプリ起動コマンドは必ず **pkill / lsof kill** を前置すること

## パッケージ確認
- `pnpm list`, `npm list`

## 🔒 Git Safety Rules (Cross-Project Guard)

| ルール | 説明 |
|--------|------|
| **プロジェクトバウンダリ** | `git add/commit/push` 前に `git rev-parse --show-toplevel` を確認 |
| **1タスク=1プロジェクト** | 複数プロジェクトにまたがるgit操作は禁止 |
| **git_guard.sh 使用推奨** | `${ANTIGRAVITY_DIR:-$HOME/.antigravity}/agent/scripts/git_guard.sh <project> <cmd>` |
| **session_state確認** | git操作前に `current_project` と一致することを確認 |

```bash
# ✅ 正しい git 操作フロー
git_guard.sh videdit status         # まずプロジェクト確認
git_guard.sh videdit add -A         # ガード付き add
git_guard.sh videdit commit -m "x"  # ガード付き commit
git_guard.sh videdit push           # ガード付き push

# ❌ 禁止パターン
cd /some/other/project && git add -A   # 別プロジェクトで気づかずcommit
git add -A && git commit               # プロジェクト未確認で操作
```

---

## 禁止コマンド
- `--dangerously-skip-permissions`（明示的に禁止）
- `rm -rf /`系の危険コマンド
- 本番環境への直接デプロイ（`/deploy`ワークフロー経由必須）
- 相対パスへの `cd` (トラブル時は禁止)

---

## Experiential Guards（経験則ガード）
セッションの実体験から学んだ運用知見。

### 外部 I/O の意識
- SSD 上の広範囲スキャン（`find` 等）は **応答が遅い場合がある** ことを前提に、スコープを絞る
- ネットワーク依存コマンド（`curl`, API 呼び出し）は **応答がない場合のフォールバック** を考慮する
- 長時間コマンドが返らないときは、**待ち続けるより別アプローチを試す**

---

## ⏱️ SSD Timeout Guard (3-Layer Defense)

SSD (`${CORE_ROOT}`) 上の**書き込み・削除コマンド**は I/O ハングリスクがある。
以下の3層防御を適用する。

### Layer 1: `perl alarm` (通常のハング対策)

通常のプロセスハング（ネットワーク待ち、ロック競合等）にはperl alarmが有効。

```bash
perl -e 'alarm 10; exec @ARGV' <command> <args>
```

> [!WARNING]
> **perl alarm の限界**: カーネル D state（Uninterruptible Sleep）のプロセスは SIGALRM を含む全シグナルを受信不可。SSD が FSEvents/Spotlight indexing でカーネルレベルブロックした場合、perl alarm では停止できない。

### Layer 2: `run_command` Background + Terminate（D state対策）

D stateが疑われる操作（`rm -rf`, 大量cp等）は、`WaitMsBeforeAsync` を小さく設定してバックグラウンド化し、`command_status` で監視 → ハングしたら `send_command_input` で Terminate する。

```
run_command(CommandLine="rm -rf /path", WaitMsBeforeAsync=500)
  → Background command ID を取得
  → command_status(CommandId, WaitDurationSeconds=10) 
  → Status == RUNNING → send_command_input(Terminate=true)
  → フォールバック（Layer 3 へ）
```

**これがSSD操作の推奨パターン。**

### Layer 3: ファイルシステムAPI直接操作（最終手段）

ターミナルが全てハングした場合:
- `write_to_file` / `view_file` / `list_dir`  は独自I/Oパスで動作する
- ターミナル不要のファイル操作が可能

### タイムアウト時のフォールバック戦略

```
Step 1: perl alarm (10s) で実行
  └─ 成功 → 完了
  └─ タイムアウト ↓

Step 2: Background + Terminate で再試行
  └─ 成功 → 完了
  └─ ハング ↓

Step 3: 代替アプローチに切り替え
  - mv → cp + 後でrm
  - rm → 後回し（データは残すがsymlink差替えで機能的に無害化）
  - cp → write_to_file ツールで直接書き込み
  └─ 全失敗 ↓

Step 4: NEXT_SESSION.md の `## 🔄 Deferred Tasks` に記録
  └─ 次回 /checkin Phase 2.75 で自動リトライ
```

### 判断基準: どの Layer を使うか

| 操作 | リスク | 推奨Layer |
|------|--------|-----------|
| 小さいファイルのcp/mv | 低 | Layer 1 (perl alarm) |
| rm -rf（ディレクトリ） | **高** | Layer 2 (Background+Terminate) |
| 大量ファイルコピー | 中 | Layer 1、失敗時Layer 2 |
| ターミナル全滅時 | 最高 | Layer 3 (API直接) |

