# Git Fetch ハング対処 運用指示書

**作成日**: 2026年3月9日

## 1. 問題の概要
`git fetch` がハング（無応答）する問題は、主に以下の 2 つの原因によって発生します。

**原因 ①  Uninterruptible Sleep（割り込み不可スリープ / D ステート）**
`git fetch` はネットワーク I/O を伴うため、カーネルレベルで I/O 待ち状態（D ステート）
に入ることがあります。この状態では SIGKILL（-9）を送っても、カーネルの I/O が
完了するまでプロセスを終了できません。

**原因 ②  pkill -9 -f が自分自身にマッチする**
`pkill -f` オプションはフルコマンドラインにマッチします。
`pkill` 自身のコマンドラインにも "git fetch" という文字列が含まれるため、
場合によっては pkill が自分自身や親シェルを kill しターミナルがフリーズします。

また、git の `http.lowSpeedLimit` / `http.lowSpeedTime` は「転送が遅い場合」にしか
効かず、「接続は確立しているが何も来ない」状態（TCP ブラックホール）では無力です。

## 2. 推奨対策

### ① timeout コマンドで外側から強制終了（最優先・最確実）
git 自身のタイムアウトに頼らず、OS レベルで強制終了するため D ステートになる前に対処できます。

```bash
# 基本形: 30 秒でタイムアウト
timeout 30 git fetch

# タイムアウト時にメッセージを表示
timeout 30 git fetch || echo 'git fetch timed out'
```

### ② SSH 使用時 — ~/.ssh/config に keepalive を追加
「接続は生きているふり」の状態（TCP ブラックホール）を早期検出します。

```ssh-config
# ~/.ssh/config
Host github.com
    ServerAliveInterval 10
    ServerAliveCountMax 3
    ConnectTimeout 15
```

### ③ 認証プロンプト待ちを防ぐ
認証プロンプト待ちでハングするケースを防止します。シェルの設定ファイルに追加してください。

```bash
# ~/.bashrc または ~/.zshrc に追加
export GIT_TERMINAL_PROMPT=0
```

### ④ 自動化・CI 環境向けラッパースクリプト
タイムアウト検知とリトライを組み合わせた堅牢なスクリプトです。

```bash
#!/bin/bash
timeout 60 git fetch --prune
EXIT=$?
if [ $EXIT -eq 124 ]; then
    echo '[WARN] git fetch timed out. Retrying...'
    timeout 60 git fetch --prune
fi
```

## 3. 症状別 対処チートシート

| 症状 | 原因 | 対策 |
| --- | --- | --- |
| HTTPS でハング | プロキシ/ファイアウォール | `timeout` コマンド + proxy 設定確認 |
| SSH でハング | TCP keepalive なし | `~/.ssh/config` に keepalive 設定 |
| 認証後にハング | クレデンシャルマネージャー | `GIT_TERMINAL_PROMPT=0` を設定 |
| 大リポジトリでハング | データ量が多い | `--depth=1` (shallow fetch) を使用 |

## 4. pkill を使う場合の注意事項
やむを得ず pkill で git fetch を終了する場合は、以下の手順に従ってください。

- まず PID を確認してから実行する
- SIGTERM（-15）で試してから SIGKILL（-9）を使う
- D ステートのプロセスはネットワーク切断 or カーネルタイムアウト待ち

```bash
# Step 1: PID を確認
pgrep -f 'git fetch'

# Step 2: まず SIGTERM で試す
pkill -f 'git fetch'

# Step 3: 2秒待って残っていれば SIGKILL
sleep 2 && pkill -9 -f 'git fetch'
```

## 5. 根本対策：git のタイムアウト設定
上記の対処に加え、git 自体にも最低限のタイムアウトを設定しておきます。
（TCP ブラックホールには効かないため、timeout コマンドと併用すること）

```bash
# 転送速度が 1000 Byte/s 以下で 30 秒続いたらタイムアウト
git config --global http.lowSpeedLimit 1000
git config --global http.lowSpeedTime 30
```

> ⚠️ **注意事項**
> D ステート（Uninterruptible Sleep）に入ったプロセスは、SIGKILL でも即時終了できません。
> ネットワーク接続が切れるか、カーネルがタイムアウトするまで待つ必要があります。
> 頻繁にハングが発生する場合は、ネットワーク機器（Proxy / Firewall）の設定も確認してください。
