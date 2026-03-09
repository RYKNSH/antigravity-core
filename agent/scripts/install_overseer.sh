#!/bin/bash
# ============================================================
# Install Script for Antigravity Overseer (launchd)
# ============================================================

set -eo pipefail

OVERSEER_BIN="$HOME/.antigravity/agent/scripts/overseer.js"
PLIST_PATH="$HOME/Library/LaunchAgents/com.rykns.antigravity.overseer.plist"

if [ ! -f "$OVERSEER_BIN" ]; then
  echo "Error: overseer.js not found at $OVERSEER_BIN"
  exit 1
fi

chmod +x "$OVERSEER_BIN"

# Create plist content
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.rykns.antigravity.overseer</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string> <!-- Replace with actual node path if different -->
        <string>$OVERSEER_BIN</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/antigravity_overseer.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/antigravity_overseer.err</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>ANTIGRAVITY_DIR</key>
        <string>$HOME/.antigravity</string>
    </dict>
</dict>
</plist>
EOF

# Load into launchd
echo "Loading daemon into launchd..."
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo "✅ The Overseer daemon installed and started via launchd."
echo "Logs: tail -f /tmp/antigravity_overseer.log"
