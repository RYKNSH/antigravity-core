---
description: 3巨頭（Steve, Elon, Jensen）による完全自律型・ビジョン駆動開発OS
---

# /vision-os - Vision-Driven Development (Titan Edition)

**Concept**: 曖昧な要望から「理想以上の完成系」を構築する。
**The Trinity**: 
- **Jensen** (Align): インタビューと進行管理
- **Steve** (Vision): 品質への執着
- **Elon** (Solve): 物理的解決と効率化

> 🏥 **Health Check Protocol 適用** — `WORKFLOW_CONTRACTS.md` 参照。全メジャーPhase間でswapチェック。

---

## Integration Map

```
/go --vision "ビジョン"
  └─ /checkin (環境準備)
  └─ /vision-os ← このワークフロー
       ├─ Phase 1: Jensen Interview
       ├─ Phase 2: Steve Vision → /debate deep --preset=titan
       ├─ Phase 3: Elon Blueprint
       ├─ Phase 4: Implementation → /evolve-wiz
       ├─ Phase 5: Quality Gate → /debate team --preset=titan
       └─ Phase 6: Completion → /blog 自動判定
  └─ /checkout (セッション終了)
```

---

## 1. Trigger

ユーザーが以下のコマンドを入力した場合に発動：

```bash
/vision-os "<Vague Request>"
# Example: /vision-os "完全自律AI駆動型開発環境"
```

または `/go --vision "<Vague Request>"` 経由で自動呼び出し。

---

## 2. Phase 1: The Interaction (Jensen Phase)

**Objective**: チームのベクトルを合わせる（Alignment）。

1.  **Execute**: `node agent/scripts/jensen_ceo.js interview "<Vague Request>"`
2.  **Act (Jensen)**: ユーザーに3つの重要な質問を投げかける。
3.  **User Input**: ユーザーが回答する。
4.  **Compile**: 回答を元に `REQUIREMENTS.md` を作成する。

---

## 3. Phase 2: Dreaming (Steve Phase + Debate Deep)

**Objective**: ビジョンを描き、ディベートで磨き上げる。

1.  **Draft**: `REQUIREMENTS.md` を元に `VISION.md` を描く。
2.  **Debate**: `/debate deep --preset=titan` を実行。
    -   ペルソナチーム: **Steve (品質)** + **Skeptic (批判)** + **Architect (構造)**
    -   Steve は `node agent/scripts/steve_job.js VISION.md critique` の指示に従い、品質への執着で議論をリード
    -   **最低3ラウンド**のディベートを経て `VISION.md` を精錬
3.  **Output**: ディベート通過済みの `VISION.md`

> [!IMPORTANT]
> 旧方式の「Steveが納得するまでリライト」ではなく、`/debate deep` のMulti-Persona議論で品質を担保する。Steveは議論の中の1ペルソナとして参加。

---

## 4. Phase 3: Blueprint (Elon Phase)

**Objective**: 物理的制約と効率を考慮した実装計画。

1.  **Analyze**: 承認された `VISION.md` を解析。
2.  **Execute**: `node agent/scripts/elon_musk.js VISION.md` の指示に従い、First Principlesで実装計画を作成。
3.  **Draft**: 実装計画 `BLUEPRINT.md` を作成。
    -   "The best part is no part."（不要な機能や工程を削除）
4.  **Quick Review**: `/debate quick` で致命的な見落としがないか確認。

---

## 5. Phase 4: Materialization (Implementation)

承認された設計図 (`BLUEPRINT.md`) を元に実装する。

1.  **Delegate**: `/evolve-wiz` (Skill Hunter + Chaos Monkey) を起動。
    -   **Jensen's Role**: エラーが発生したら `node agent/scripts/jensen_ceo.js cheer` でログを鼓舞する。
2.  **Verify**: 実装完了後、`/verify` を自動実行。

---

## 6. Phase 5: Quality Gate (Steve + Debate Team)

**Objective**: ビジョンとの乖離チェック + チーム合意。

1.  **Compare**: 実装コードと `VISION.md` を比較。
2.  **Debate**: `/debate team --preset=titan` を実行。
    -   **全員が `Approve` するまで終わらない**。
    -   Steve が `Block` した場合 → 問題箇所を修正して再提出。
3.  **Final Polish**: 最後の微調整。

> [!NOTE]
> 旧方式の Steve 単独レビューから、`/debate team` による合意形成に進化。
> Steve/Elon/Jensen + Skeptic の全員合意が必要。

---

## 7. Phase 6: Completion (The Keynote + Knowledge Capture)

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

### Knowledge Capture（自動）

完成後、以下を自動判定:
- `VISION.md` + `BLUEPRINT.md` + 最終成果物 → **Social Knowledge として記事化する価値があるか？**
- 判定基準: 新規ファイル数 > 3、または git diff 行数 > 100
- 閾値超え → 「この成果を `/blog` で記事にしますか？」と提案
- 閾値以下 → スキップ（checkout時の Phase 0 で再度判定）

---

## 8. Titan Preset for /debate

`/debate --preset=titan` で自動編成されるチーム:

| Persona | Role | Source |
|---------|------|--------|
| **Jensen** | Moderator / Alignment | `agent/scripts/jensen_ceo.js` |
| **Steve** | Vision / Quality Gate | `agent/scripts/steve_job.js` |
| **Elon** | Efficiency / First Principles | `agent/scripts/elon_musk.js` |
| **Skeptic** | Critical Review | `persona-orchestration/personas/` |

> [!TIP]
> Titan プリセットは `/vision-os` 専用。通常の `/debate` は persona-orchestration の動的チーム編成を使う。

---

## Toolchain

**Scripts**: `jensen_ceo.js`, `steve_job.js`, `elon_musk.js`
**Skills**: `persona-orchestration`, `first-principles`
**Knowledge**: `persona_orchestration_system`
