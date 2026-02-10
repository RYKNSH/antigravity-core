#!/bin/bash
# ============================================================
# Antigravity Bootstrap — SSD初回セットアップ
#
# Usage: bash /Volumes/PortableSSD/.antigravity/setup.sh
#
# 実行内容:
# 1. Node.js 存在チェック
# 2. npm install (heartbeat/package.json)
# 3. LaunchAgent plist を登録
# 4. queue ディレクトリを作成
# 5. APIキーをKeychainに登録（対話型、初回のみ）
# ============================================================

set -e

SSD_ROOT="/Volumes/PortableSSD"
ANTIGRAVITY_DIR="$SSD_ROOT/.antigravity"
HEARTBEAT_DIR="$ANTIGRAVITY_DIR/heartbeat"
PLIST_NAME="com.antigravity.heartbeat"
PLIST_SRC="$HEARTBEAT_DIR/$PLIST_NAME.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

echo "🚀 Antigravity Bootstrap"
echo "========================"
echo ""

# --- 1. Node.js チェック ---
echo "🔍 Step 1: Node.js チェック..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js が見つかりません。"
    echo "   インストール: https://nodejs.org/ (v18以上)"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js v18以上が必要です。現在: $(node -v)"
    exit 1
fi
echo "✅ Node.js $(node -v) detected"

# --- 2. npm install ---
echo ""
echo "📦 Step 2: 依存パッケージインストール..."
cd "$HEARTBEAT_DIR"
npm install --production --silent 2>/dev/null || true
echo "✅ Dependencies ready (zero external deps)"

# --- 3. Queue ディレクトリ作成 ---
echo ""
echo "📂 Step 3: Queue ディレクトリ作成..."
mkdir -p "$ANTIGRAVITY_DIR/queue/pending"
mkdir -p "$ANTIGRAVITY_DIR/queue/running"
mkdir -p "$ANTIGRAVITY_DIR/queue/completed"
mkdir -p "$ANTIGRAVITY_DIR/queue/blocked"
mkdir -p "$ANTIGRAVITY_DIR/logs"
echo "✅ Queue directories created"

# --- 4. LaunchAgent 登録 ---
echo ""
echo "🔧 Step 4: LaunchAgent 登録..."

# plist が存在しなければ生成
if [ ! -f "$PLIST_SRC" ]; then
    echo "  Generating plist..."
    cat > "$PLIST_SRC" << 'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.antigravity.heartbeat</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Volumes/PortableSSD/.antigravity/heartbeat/heartbeat.js</string>
    </array>
    <key>StartInterval</key>
    <integer>30</integer>
    <key>StandardOutPath</key>
    <string>/Volumes/PortableSSD/.antigravity/logs/heartbeat.log</string>
    <key>StandardErrorPath</key>
    <string>/Volumes/PortableSSD/.antigravity/logs/heartbeat.error.log</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>PathState</key>
        <dict>
            <key>/Volumes/PortableSSD/.antigravity/heartbeat/heartbeat.js</key>
            <true/>
        </dict>
    </dict>
</dict>
</plist>
PLIST_EOF
fi

# Node.js パスを動的に修正 (homebrew or nvm)
NODE_PATH=$(which node)
sed -i '' "s|/usr/local/bin/node|$NODE_PATH|g" "$PLIST_SRC"

# 既存のLaunchAgentを停止
if [ -f "$PLIST_DEST" ]; then
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
fi

# コピーしてロード
cp "$PLIST_SRC" "$PLIST_DEST"
launchctl load "$PLIST_DEST"
echo "✅ LaunchAgent registered and started"

# --- 5. APIキー設定（初回のみ） ---
echo ""
echo "🔑 Step 5: APIキー設定..."

# Keychainに既にあるかチェック
EXISTING_KEY=$(security find-generic-password -s "antigravity-api" -a "anthropic" -w 2>/dev/null || echo "")

if [ -z "$EXISTING_KEY" ]; then
    # .env から読み込みを試みる
    ENV_FILE="$ANTIGRAVITY_DIR/.env"
    if [ -f "$ENV_FILE" ]; then
        API_KEY=$(grep "ANTHROPIC_API_KEY" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        if [ -n "$API_KEY" ]; then
            security add-generic-password -s "antigravity-api" -a "anthropic" -w "$API_KEY" -U
            echo "✅ APIキーを.envからKeychainに登録しました"
        else
            echo "⚠️  ANTHROPIC_API_KEY が .env に見つかりません"
            echo "   手動設定: security add-generic-password -s \"antigravity-api\" -a \"anthropic\" -w \"YOUR_KEY\""
        fi
    else
        echo "⚠️  .env ファイルが見つかりません"
        echo "   手動設定: security add-generic-password -s \"antigravity-api\" -a \"anthropic\" -w \"YOUR_KEY\""
    fi
else
    echo "✅ APIキーは既にKeychainに登録済み"
fi

# --- 完了 ---
echo ""
echo "============================================================"
echo "🎉 Antigravity Bootstrap Complete!"
echo ""
echo "  Heartbeat: 30秒ごとにキューを監視中"
echo "  Queue:     $ANTIGRAVITY_DIR/queue/pending/"
echo "  Logs:      $ANTIGRAVITY_DIR/logs/"
echo ""
echo "  タスクを追加:"
echo "    echo '# Fix bug X' > $ANTIGRAVITY_DIR/queue/pending/001_task.md"
echo ""
echo "  テスト実行:"
echo "    node $HEARTBEAT_DIR/heartbeat.js --dry-run"
echo ""
echo "  停止:"
echo "    launchctl unload ~/Library/LaunchAgents/$PLIST_NAME.plist"
echo "============================================================"
echo ""
echo "SSD is alive. 💓"
