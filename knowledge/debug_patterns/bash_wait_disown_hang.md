# bash_wait_disown_hang.md

## パターン: bash `wait` + ネットワーク系バックグラウンドジョブ = 永続ハング

**カテゴリ**: bash / shell

### 症状
- `bash スクリプト` が `wait` で永久フリーズ
- プロセスが `if [[ " $...` のような途中の状態で2時間以上ハング
- 後続コマンドが実行できない

### 根本原因
`wait` コマンドは**全てのバックグラウンドジョブ（`&`）が終了するまでブロック**する。
ネットワーク待ち（`git pull`、`curl` 等）のジョブが終わらない場合、`wait` も終わらない。

### 解決策: 3ゾーン分離パターン

```bash
# SLOW ZONE — ネットワーク依存 → disown で完全切り離し（wait対象外）
( git pull origin main ) &
disown $!

# FAST ZONE — ローカルI/Oのみ → wait OK（< 2秒）
rsync -a src/ dst/ &
cp config.json ~/.config/ &
wait  # ← ローカルジョブのみ待つ

# SYNC — waitが必要な処理はここに書く
echo "done"
```

### チェックリスト
- [ ] `&` でバックグラウンド起動したジョブは全て `disown` か？（ネットワーク系）
- [ ] `wait` の前にある `&` ジョブは全てローカルI/Oのみか？
- [ ] `git pull` / `git fetch` には `GIT_TERMINAL_PROMPT=0` + `disown` がついているか？

### 発見プロジェクト
BLOG — checkin.md v3 → v4 移行時 (2026-02-24)
