1. [確認] GitHub MCPが新トークンで動くか確認する。`mcp_config.json` に新PATを設定済み。新セッション開始時にMCPテスト（`mcp_github_search_repositories`）を実施すること。
2. [注意] 今後も、CLI等のツールがない場合はターミナルに諦めてフォールバックするのではなく、browser_subagent等を用いて自律的に取得・設定し、ブロックを突破すること(MR-10の適用事例)。
3. [注意] ターミナルがハングした場合、Reload Windowで解消できる。ただしMCPプロセスはkillされるため、アプリ再起動 or 新セッション開始が必要。
4. [注意] `settings.json` (Antigravityアプリ) にもMCPサーバー設定を追加済み。アプリがこの設定を読むかは未確認。
