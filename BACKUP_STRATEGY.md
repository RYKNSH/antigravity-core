# 💾 Backup Strategy

> SSD紛失・故障に備えたバックアップ戦略

## バックアップ対象

| 対象 | 重要度 | 頻度 |
|-----|-------|------|
| `.antigravity/` 全体 | 🔴 最高 | 週1回 |
| `agent/rules/` | 🔴 最高 | 変更時 |
| `agent/workflows/` | 🟡 高 | 週1回 |
| `agent/skills/` | 🟡 高 | 週1回 |
| `knowledge/` | 🟡 高 | 週1回 |
| `agent/scripts/` | 🟢 中 | 月1回 |
| `logs/` | ⚪ 低 | 不要 |

---

## バックアップ方法

### Option 1: iCloud Drive (推奨)

```bash
# 初回設定
ln -s /Volumes/PortableSSD/.antigravity ~/Library/Mobile\ Documents/com~apple~CloudDocs/antigravity_backup

# または手動コピー
cp -R /Volumes/PortableSSD/.antigravity ~/Library/Mobile\ Documents/com~apple~CloudDocs/antigravity_backup_$(date +%Y%m%d)
```

### Option 2: Git (バージョン管理込み)

```bash
cd /Volumes/PortableSSD/.antigravity
git init
git add -A
git commit -m "backup: $(date +%Y-%m-%d)"
git remote add origin git@github.com:YOUR_USER/antigravity-backup.git
git push -u origin main
```

> ⚠️ `.env`ファイルは`.gitignore`に追加すること

### Option 3: Time Machine

SSD全体をTime Machineのバックアップ対象に追加。

---

## リカバリ手順

### SSD紛失時

1. 新しいSSDを用意
2. バックアップから`.antigravity/`を復元
3. `/project-init`を実行
4. `~/.secrets/antigravity/.env`を再設定

### SSD故障時

1. 可能なら故障SSDからデータ救出を試みる
2. 不可能な場合はバックアップから復元
3. 上記と同じ手順

---

## バックアップ自動化

毎週日曜日に自動バックアップを実行するlaunchd設定:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.antigravity.backup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cp -R /Volumes/PortableSSD/.antigravity ~/Library/Mobile\ Documents/com~apple~CloudDocs/antigravity_backup_$(date +%Y%m%d)</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>0</integer>
        <key>Hour</key>
        <integer>3</integer>
    </dict>
</dict>
</plist>
```

保存先: `~/Library/LaunchAgents/com.antigravity.backup.plist`

---

## 最終バックアップ

| 日付 | 方法 | 場所 |
|-----|------|------|
| - | - | (未実行) |
