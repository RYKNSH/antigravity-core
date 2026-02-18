# Portable Studio: Deployment & Usage Protocol

開発効率とポータビリティを両立させるため、Portable Studio は特定のビルド・デプロイモデルを採用しています。

## 🏗️ ビルドとデプロイのフロー (Build & Deployment)

外付け SSD (ExFAT 形式) 上でのビルドは AppleDouble (`._*`) ファイルによるパニックや低速 I/O の問題があるため、ホストマシンの高速な領域でビルドを行い、成果物を SSD に配備します。

1.  **APFS ホストでのビルド**: ホストマシンの `/Users/<username>/.tmp_build` ディレクトリでビルドを実行。
2.  **SSD への自動配備 (Deployment)**: ビルド完了後、成果物（`.app` および `.dmg`）を SSD のルート直下 (`/Volumes/PortableSSD/`) に自動コピー。
3.  **上書き更新**: 既存の `.app` を上書きすることで、SSD 上には常に最新の「ライブ」バージョンが保持されます。
4.  **クリーンビルド・コマンド (One-liner for AI)**: 以前のキャッシュを破棄し、確実に最新の状態を SSD へ届けるためのコマンド。
    ```bash
    rm -rf ~/.tmp_build/portable-studio/target && mkdir -p ~/.tmp_build/portable-studio && CARGO_TARGET_DIR=~/.tmp_build/portable-studio pnpm tauri build && cp -R ~/.tmp_build/portable-studio/release/bundle/macos/portable-studio.app /Volumes/PortableSSD/ && cp ~/.tmp_build/portable-studio/release/bundle/dmg/portable-studio_0.1.0_aarch64.dmg /Volumes/PortableSSD/ && open /Volumes/PortableSSD/
    ```

## 🚀 アプリの起動と使用方法 (Execution)

SSD 上のアプリには 2 つの形態があります。

### 1. ライブ・アプリケーション (`portable-studio.app`) - **推奨**
- **場所**: `/Volumes/PortableSSD/portable-studio.app`
- **使用方法**: この本体を直接ダブルクリックして起動します。
- **メリット**: **インストール不要**。開発者がデプロイした最新の修正が即座に反映されます。普段の作業や機能検証にはこちらを使用してください。

### 2. インストーラー (`portable-studio_x.x.x_aarch64.dmg`)
- **場所**: `/Volumes/PortableSSD/portable-studio_0.1.0_aarch64.dmg`
- **使用方法**: DMG を開き、アプリを `/Applications` (マシンの内蔵ストレージ) へドラッグ＆ドロップしてインストールします。
- **用途**: 
  - 他の Mac にアプリを恒久的にインストールする場合の「持ち運び用インストーラー」。
  - インターネット環境がない場所での配布。
- **重要な注意**: **DMG は「その時点の静的なスナップショット」です**。SSD 本体のアプリが更新されても、DMG の中身や、既にインストール済みのローカルアプリは自動的にはアップデートされません。最新版を他の Mac で使いたい場合は、新しい DMG を作成して再インストールする必要があります。

## 💡 ユーザーへのベストプラクティス
- **常に `.app` を開く**: SSD を持ち運んで作業する場合、常に SSD 内の `.app` を開く習慣をつけることで、バージョン管理に悩まされることなく最新の機能（Git 自動コミット連携等）を利用できます。
- **環境のクリーンアップ**: アプリが古い状態を記憶しているように見える場合は、[Troubleshooting Guide](./troubleshooting.md) に記載されているキャッシュパージ手順を実行してください。
