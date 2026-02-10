---
description: セッション開始前にメモリを軽量化し安定動作を確保
---
# Lightweight Operation (軽量動作モード)

Antigravityセッション開始前にシステムを軽量化。

## Cross-Reference

```
/checkin Phase 1 = 基本クリーンアップ（毎セッション）
/lightweight = メモリ軽量化（オンデマンド）
/cleanup-48h = ディープクリーンアップ（定期実行）
```

> [!NOTE]
> `/checkin` がセッション開始時の標準クリーンアップ。
> `/lightweight` はより積極的なメモリ解放（purge, Chrome SW削除等）が必要な時に使う。
> 並列セッション前・重いタスク前・エラー頻発時に呼び出される。

## 実行タイミング

- 複数セッション開始前
- 重いタスク（ブラウザ操作、長時間作業）開始前
- エラー頻発時

// turbo-all

## チェック & 軽量化

1. メモリ状態確認
```bash
echo "=== Memory ===" && vm_stat | head -5 && echo "---" && sysctl vm.swapusage
```

2. 48h+キャッシュ削除 (browser_recordings)
```bash
find ~/.gemini/antigravity/browser_recordings -type f -mtime +2 -delete && find ~/.gemini/antigravity/browser_recordings -type d -empty -delete
```

3. Chrome Service Worker削除
```bash
rm -rf ~/Library/Application\ Support/Google/Chrome/Default/Service\ Worker 2>/dev/null && echo "Chrome SW cleared"
```

4. npm cache削除
```bash
rm -rf ~/.npm/_npx ~/.npm/_logs ~/.npm/_prebuilds ~/.npm/_cacache 2>/dev/null && echo "npm cache cleared"
```

5. macOSメモリ圧縮 (sudo不要)
```bash
purge 2>/dev/null || echo "purge requires sudo, skipping"
```

6. 最終確認
```bash
df -h / | tail -1 && echo "---" && sysctl vm.swapusage
```

## 追加対策（手動）

Swap使用率が80%超の場合：
- 不要なChromeタブを閉じる
- 使っていないアプリを終了
- 再起動を検討
