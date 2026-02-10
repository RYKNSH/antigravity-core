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

