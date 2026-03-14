---
description: 広告クリエイティブの全工程をカバーするメタコマンド。brief/review/build の3サブコマンドで「ブリーフ確認→4ペルソナレビュー→QC+レンダリング出力」を統合実行する。
---

# /ad — Creative Command Hub

> **旧コマンド `creative-board` / `creative-pipeline` はこのコマンドに統合されました**
> 覚えることは `/ad` の1コマンドだけ。

---

## サブコマンド一覧

| コマンド | 役割 | 内部WF |
|---------|------|--------|
| `/ad brief` | CREATIVE_BRIEFを確認・対話的に更新する | — |
| `/ad review` | The Creative Board（4ペルソナ）でレビューする | ← 旧 `/creative-board` |
| `/ad build` | QC → レンダリング → デスクトップ出力 | ← 旧 `/creative-pipeline` |
| `/ad studio` | Remotion Studioを起動してGUIで編集する | ← 視覚編集モード |
| `/ad learn` | GUI編集の差分を解析して知見を蓄積する | ← 学習ループ |
| `/ad` (引数なし) | brief確認 → review → build を順番に自律実行 | フルパイプライン |

---

## GUI編集→学習ループ（推奨フロー）

```
1. /ad studio     ← Remotion Studio でビジュアル編集（localhost:3000）
2. (好みに編集してLpAd.tsxを保存)
3. /ad learn      ← git diffから差分を抽出→learned_preferences.jsonに蓄積
4. /ad review     ← 学習済み知見をCreative Boardへ注入してレビュー
5. /ad build      ← QC通過後レンダリング
```

これを繰り返すことでAIがユーザーの好みを学習し、次回生成が自動で最適化される。


---

## `/ad brief` — ブリーフ確認

// turbo
```bash
cat ~/.antigravity/agent/knowledge/creative_dataset/CREATIVE_BRIEF.md
```

CREATIVE_BRIEFを表示する。ユーザーから更新指示があれば対話的に修正する。
修正後は `lp_ad_scenes.json` との整合性も確認する。

---

## `/ad studio` — Remotion Studio + 自動学習ウォッチャー

以下を **同時に** 起動する。

// turbo
```bash
node ~/.antigravity/agent/scripts/creative_watch.js &
WATCH_PID=$!
echo "👁️  creative_watch.js PID: $WATCH_PID"
```

```bash
cd ~/.antigravity/media/remotion && npx remotion studio
```

> **自動動作**: LpAd.tsx を保存するたびに `creative_learn.js` が自動実行される。  
> Studio終了後は `kill $WATCH_PID` でウォッチャーを停止する。

---

## `/ad review` — Creative Board Review（旧 `/creative-board`）

以下のStep 1〜3を自律実行する。

### Step 0: 学習済みスタイルガイドを自動注入（必須）

// turbo
```bash
cat ~/.antigravity/agent/knowledge/creative_dataset/creative_style_guide.md 2>/dev/null || echo "(まだ学習データなし)"
```

> **このファイルが存在する場合、その内容はStep 2の全ペルソナ評価に自動注入される。**  
> ペルソナは「ユーザーが過去に好んだ選択」を最優先で尊重してレビューする。

### Step 1: 知識ブリーフの自動注入

// turbo
```bash
cat ~/.antigravity/agent/knowledge/creative_dataset/CREATIVE_BRIEF.md
cat ~/.antigravity/agent/knowledge/creative_dataset/lp_ad_scenes.json
cat ~/.antigravity/agent/knowledge/creative_dataset/solopro_emotion_map.json
cat ~/.antigravity/agent/knowledge/creative_dataset/marketing_frameworks.json
```

### Step 2: 4ペルソナ自律ディベート

**[自動注入] creative_style_guide.md の内容（Step 0で取得済み）を全ペルソナへ注入する。**  
ペルソナは「学習済みスタイルガイドに沿っているか」を評価軸の一つに加える。  
違反している箇所は BLOCK として指摘し、学習済み好みに従って修正を提案する。

全ペルソナが `Approve` を出すまでラウンドを繰り返す。妥協禁止。

**ペルソナと評価軸:**
- **CD**: ブランドの一貫性 / Core "Why"の体現 / ターゲットとのアンカー
- **AD**: タイポグラフィのジャンプ率 / 余白比率 / ビジュアル品質 / **学習済みタイポ好みとの整合**
- **Marketer**: 3秒フック / 感情アーク empathy→fomo→hope→liberation / 死パターン非含有
- **Screenwriter**: 感情曲線の起伏 / ナレーションのリズム / 沈黙の設計

### Step 3: 合意後の自律修正

全員 Approve 後、対象ファイル（LpAd.tsx等）を直接修正して完了。  
修正後は git commit して次回の学習ベースラインを更新する:

// turbo
```bash
cd ~/.antigravity/media/remotion && git add src/templates/lp/LpAd.tsx && git commit -m "refine: creative board approved changes"
```

---

## `/ad build` — QC → レンダリング → 出力（旧 `/creative-pipeline`）

### Step 1: Rule-Based QC（Layer 3）

// turbo
```bash
node ~/.antigravity/agent/scripts/creative_qc.js \
  --scenes ~/.antigravity/agent/knowledge/creative_dataset/lp_ad_scenes.json \
  --tsx ~/.antigravity/media/remotion/src/templates/lp/LpAd.tsx \
  --format 30s
```

**QCがBLOCKEDの場合**: 直ちに停止。`/ad review` を先に実行して問題を修正してから再実行。
**QCがAPPROVEDの場合**: 次ステップへ進む。

### Step 2: レンダリング

// turbo
```bash
cd ~/.antigravity/media/remotion && npx remotion render src/index.tsx lp-ad out/lp-ad.mp4
```

### Step 3: デスクトップへ出力

// turbo
```bash
cp ~/.antigravity/media/remotion/out/lp-ad.mp4 ~/Desktop/lp-ad-$(date +%Y%m%d-%H%M).mp4 && echo "✅ Desktop: lp-ad-$(date +%Y%m%d-%H%M).mp4"
```

---

## `/ad`（引数なし）— フルパイプライン自律実行

以下を順番に自律実行する:
1. `/ad brief` — ブリーフ確認（変更がなければスキップ）
2. `/ad review` — Creative Board レビュー（修正があれば自動適用）
3. `/ad build` — QC通過後にレンダリング・出力

---

## 完了条件

- [ ] QC Verdict: APPROVED（Blocking 0）
- [ ] `~/Desktop/lp-ad-YYYYMMDD-HHMM.mp4` が存在する
- [ ] Creative Board 全ペルソナ: Approve
