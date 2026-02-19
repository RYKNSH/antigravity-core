# 🌴 Remote Mac Mini "Vibe Coding" Guide

iPad（タッチ操作＆音声入力）で、どこからでもMac miniを操作するための完全マニュアルです。

## ✅ 接続手順 (通常利用)

1.  **TailscaleをON**
    - iPadの `Tailscale` アプリを開き、左上が `Active` になっていることを確認。
    - （Mac mini側は常時ONになっています）
2.  **Jump Desktopで接続**
    - iPadの `Jump Desktop` アプリを開く。
    - `ryotaromac-mini` (または `100.127.87.2`) をタップ。
3.  **Vibe Coding開始**
    - 画面が表示されたら、いつもの開発環境です。

## 🖐️ iPad操作のコツ (For Touch & Voice)

トラックパッドなしで快適に操作するための設定です。

### ジェスチャ (Jump Desktop設定)
- **1本指タップ**: 左クリック
- **2本指タップ**: 右クリック（メニュー表示）
- **3本指ドラッグ**: **範囲選択（テキスト選択）** ※最重要

### 音声入力 (The AI Director Style)
- **Cmd + L**: `Cursor` のチャットを開く
- **Cmd + I**: `Cursor` の全画面エディタ(Composer)を開く
- **入力**: iPadのソフトウェアキーボードのマイクボタンを押し、音声で指示。

## 🚨 トラブルシューティング

### Q. 繋がらない！
1.  **Tailscale確認**: iPadのVPNアイコンが出ていますか？アプリで `Active` か確認してください。
2.  **Macの電源**: 一時的な停電などで落ちている可能性があります。
    - **対策**: スマートプラグ（SwitchBot等）があれば、スマホから一度電源をOFF→ONして、Macが自動起動するのを待ちます。

### Q. 画面が真っ暗 / 解像度がおかしい
- Mac miniにディスプレイが繋がっていない場合、GPUが映像を作らないことがあります。
- **対策**: `BetterDisplay` アプリで `Dummy Display` を作成し、それをメインディスプレイにしてください。（設定済みのはずです）

### Q. 動きがカクカクする
- 通信環境が悪い可能性があります。
- **対策**: Jump Desktopの設定で `Fluid Remote Desktop` が有効か確認してください。これが最強のプロトコルです。

---

## 🔧 設定内容 (Technical Details)
- **VPN**: Tailscale (Zero-config VPN)
- **Remote Desktop**: Jump Desktop Connect (Fluid Protocol)
- **Display**: BetterDisplay (Virtual HiDPI)
- **System**:
    - `autorestart`: 停電復帰時に自動起動
    - `womp`: Wake on LAN有効
    - `ssh`: 緊急時のコマンド操作用ポート(22)開放
