# Implementation Plan - Remote Mac Mini "Touch & Voice" Setup

トラックパッドなし（iPad単体）で、音声入力とタッチ操作を駆使して開発するための環境構築計画です。
「コードを自分で書かない（AIに書かせる）」ことに特化した設定を行います。

## User Review Required

> [!IMPORTANT]
> **操作パラダイムの変更**
> マウスがないため、精密なカーソル操作は不可能です。
> **「Cursor (AI) の Composer (Cmd+I) を開き、音声で指示してコードを書かせる」** スタイルを徹底する必要があります。

## Proposed Changes (Setup Steps)

### 1. Network & Security Layer (Unchanged)
#### [No Change] Tailscale Setup
- 変更なし。ゼロコンフィグVPNで接続。

#### [No Change] SSH Access
- 変更なし。GUI操作不能時の命綱。

### 2. Control Layer (Touch Optimized)
#### [MODIFY] Jump Desktop Config (Critical)
- **Fluid Protocol**: 必須。
- **Gesture Config (User Action)**:
    - インストールは自動化しますが、以下の設定はユーザーの手動調整が重要です（設定手順書を提供します）。
    - **Tap to Click**: ON
    - **One finger drag**: Pan/Scroll (スクロール優先)
    - **Three finger drag**: Selection (範囲選択用) ← **最重要**

#### [MODIFY] BetterDisplay
- **Action**: iPadの画面比率に合わせた解像度作成。
- **Add**: ソフトウェアキーボードが表示された際に画面が隠れすぎないよう、解像度プリセットを複数用意することを推奨。

### 3. Vibe Coding Optimization (Voice First)
#### [NEW] Dictation Setup
- **Action**: Mac側の「音声コントロール」はオフ（iPadの音声入力を使うため、競合回避）。
- **Workflow**:
    1. Jump Desktopで接続。
    2. ソフトウェアキーボードを開く（画面右下のボタン）。
    3. マイクアイコンをタップして音声入力。
    4. 結果がMacに送信される。

#### [INFO] Recommended Shortcuts (Touch-Friendly)
- **Cmd + L**: Chatを開く（ここなら誤タップしても大丈夫）。
- **Cmd + I**: Composerを開く（全画面AIエディタ）。
- **Cmd + Shift + F**: 全体検索（ファイルを探す手間を省く）。

## Verification Plan

### Automated Verification
- 前回同様、brewパッケージとシステム設定の確認。

### Manual Verification (Touch & Voice)
1. **Gesture Test**: 3本指ドラッグでテキスト選択ができるか？
2. **Dictation Test**: iPadのマイクで喋った内容が、遅延なくMac上のCursorに入力されるか？
3. **Keyboard Test**: ソフトウェアキーボードを表示した状態で、エディタ画面が見えるか？（BetterDisplayのHiDPI調整）
4. **Setup Script**: スクリプト内容は前回と同じで問題ありません（ハードウェア依存ではなくソフト依存のため）。
