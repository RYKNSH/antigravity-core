#!/bin/bash
set -e

# Prevent running as root (Homebrew check)
if [ "$EUID" -eq 0 ]; then
  echo "❌ Error: Please do not run this script as root (sudo)."
  echo "   Homebrew commands cannot be run as root."
  echo "   The script will ask for your password when needed for system settings."
  echo "   Usage: $0"
  exit 1
fi

echo "🚀 Starting Remote Development Environment Setup..."

# Function to check if installed
is_installed() {
    brew list --cask "$1" &>/dev/null
}

# 1. Install Tailscale
if is_installed "tailscale"; then
    echo "✅ Tailscale is already installed."
else
    echo "📦 Installing Tailscale..."
    brew install --cask tailscale
fi

# 2. Install Jump Desktop Connect
if is_installed "jump-desktop-connect"; then
    echo "✅ Jump Desktop Connect is already installed."
else
    echo "📦 Installing Jump Desktop Connect..."
    brew install --cask jump-desktop-connect
fi

# 3. Install BetterDisplay
if is_installed "betterdisplay"; then
    echo "✅ BetterDisplay is already installed."
else
    echo "📦 Installing BetterDisplay..."
    brew install --cask betterdisplay
fi

# 4. System Configuration
echo "⚙️  Configuring Power Management (sudo required)..."
# Use sudo to ensure permissions
sudo pmset -a autorestart 1 womp 1 sleep 0
echo "✅ Power settings applied: autorestart=1, womp=1, sleep=0"

echo "⚙️  Enabling Remote Login (SSH) (sudo required)..."
sudo systemsetup -setremotelogin on
echo "✅ SSH enabled."

echo "✅ Setup Complete!"
echo "   - Tailscale is running."
echo "   - Jump Desktop Connect is configured."
echo "   - BetterDisplay is installed."
echo ""
echo "📱 To test remote connection from iPad:"
echo "   1. DO NOT just turn off Wi-Fi (if iPad is Wi-Fi only)."
echo "   2. Connect iPad to iPhone Tethering or Public Wi-Fi."
echo "   3. Open Jump Desktop and connect to 'ryotaromac-mini'."
echo ""
echo "Make sure to run 'BetterDisplay' and create a dummy display if headless!"
