---
description: 3巨頭（Steve, Elon, Jensen）による完全自律型・ビジョン駆動開発OS
---

# /vision-os - Vision-Driven Development (Titan Edition)

**Concept**: 曖昧な要望から「理想以上の完成系」を構築する。
**The Trinity**: 
- **Jensen** (Align): インタビューと進行管理
- **Steve** (Vision): 品質への執着
- **Elon** (Solve): 物理的解決と効率化

---

## 1. Trigger

ユーザーが以下のコマンドを入力した場合に発動：

```bash
/vision-os "<Vague Request>"
# Example: /vision-os "A landing page for a coffee shop"
```

---

## 2. The Interaction (Jensen Phase)

**Objective**: チームのベクトルを合わせる（Alignment）。

1.  **Execute**: `node agent/scripts/jensen_ceo.js interview "<Vague Request>"`
2.  **Act (Jensen)**: ユーザーに3つの重要な質問を投げかける。
3.  **User Input**: ユーザーが回答する。
4.  **Compile**: 回答を元に `REQUIREMENTS.md` を作成する。

---

## 3. The Hidden Loop (Black Box)

ユーザーとの対話が終わったら、裏側で巨頭たちが激論を交わす。

### Phase 1: Dreaming (Steve Phase)
1.  **Draft**: `REQUIREMENTS.md` を元に `VISION.md` を描く。
2.  **Steve Filter**: `node agent/scripts/steve_job.js VISION.md critique`
    -   Steveが納得するまでリライトを繰り返す。

### Phase 2: Blueprint (Elon Phase)
1.  **Analyze**: 承認された `VISION.md` を解析。
2.  **Execute**: `node agent/scripts/elon_musk.js VISION.md`
3.  **Draft**: 物理的制約と効率を考慮した実装計画 `BLUEPRINT.md` を作成。
    -   "The best part is no part."（不要な機能や工程を削除）

### Phase 3: Materialization (The Team)
承認された設計図 (`BLUEPRINT.md`) を元に実装する。

1.  **Delegate**: `/evolve-wiz` (Skill Hunter + Chaos Monkey) を起動。
    -   **Jensen's Role**: エラーが発生したら `node agent/scripts/jensen_ceo.js cheer` でログを鼓舞する。

### Phase 4: The Gate (Steve Phase)
1.  **Compare**: 実装コードと `VISION.md` を比較。
2.  **Execute**: `node agent/scripts/steve_job.js <ImplementedFile> critique`
3.  **Final Polish**: 最後の微調整。

---

## 4. Completion (The Keynote)

全てのゲートを通過した成果物を提示する。

```markdown
# 🍎 Titan OS Output

## The Vision (by Steve)
(Emotion & Design)

## The Blueprint (by Elon)
(Efficiency & Architecture)

## The Reality
- [Link to Implementation]

"It just works."
```
