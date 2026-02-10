#!/bin/bash

# Checkpoint Setup Script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECKPOINT_JS="$SCRIPT_DIR/checkpoint-core.js"
ALIAS_CMD="alias checkpoint='node \"$CHECKPOINT_JS\"'"

# Detect Shell
if [ -n "$ZSH_VERSION" ]; then
    RC_FILE="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    RC_FILE="$HOME/.bashrc"
else
    RC_FILE="$HOME/.zshrc" # Default to zsh
fi

echo "🔧 Setting up 'checkpoint' command..."

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Add alias if not exists
if grep -q "alias checkpoint=" "$RC_FILE"; then
    echo "✅ Alias already exists in $RC_FILE"
else
    echo "" >> "$RC_FILE"
    echo "# Antigravity Checkpoint Tool" >> "$RC_FILE"
    echo "$ALIAS_CMD" >> "$RC_FILE"
    echo "✅ Added alias to $RC_FILE"
fi

# Install dependencies if node_modules missing
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd "$SCRIPT_DIR"
    npm install
fi

echo "👉 Please run: source $RC_FILE"
echo "🎉 Setup complete! You can now use 'checkpoint' command."
