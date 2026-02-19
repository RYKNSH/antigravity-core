# Autonomous Feedback Loop (FBL) Overview

## Philosophy: The 120% Standard
The core philosophy of FBL is that in the AI era, **substance and quality (120%) take precedence over mere form**. A feature is not complete when it "works"; it is complete when it is highly polished, verified across all layers (Frontend, API, DB), and provides an "emotionally moving" (感動) experience for the user.

## The "Genius Team" (Specialized FBL Personas)
To achieve this, the FBL command assigns a specialized team of AI interns:

| Persona | Responsibility | Expertise |
|---------|----------------|-----------|
| **Bug Hunter** | Phase 0 | Error analysis, debug, lint/typecheck/test |
| **Full-Stack Verifier** | Phase 1, 2, 4 | DB Integrity, API Contracts, E2E Data Flow |
| **Browser Inspector** | Phase 3 | Visual regression, Responsive, UI interaction |
| **UX Advocate** | Phase 5 | 120% Quality check, Accessibility, Delight |

## Workflow Variations
- `/fbl`: Standard 8-phase loop for normal features.
- `/fbl quick`: Lightweight verification (lint + visual) for small CSS or text fixes.
- `/fbl deep`: Exhaustive full-stack verification including a final Persona Debate round.
- **DEEP FBL AUDIT**: 2026-02-04 に確立された究極の品質向上プロトコル。単一の機能検証ではなく、100項目の「課題チェックリスト」を策定し、`browser_subagent` による全パラメーターの網羅的なスイープテストを通して、エッジケースや視覚的な微細アーティファクト（例：16方向シャドウが必要なトゲ等）をあぶり出し、一つずつ確実に解消する。

## Important Distinction: Development FBL vs. Product ML Feedback Loop
本 Knowledge Item で定義される **Feedback Loop (FBL)** は、AI エージェントを用いた **システムの開発・品質検証プロセス** を指します。

ユーザーがアプリ UI 上で行う「文字起こしやタイムスタンプの修正」を AI モデルの学習に反映させる **Product-level ML Feedback Loop** （強化学習や微調整）とは、以下の点で異なります：
- **Development FBL**: コードの正確性、UI の挙動、データの整合性を AI interns が監査・修正するプロセス。
- **Product ML Feedback Loop**: ユーザーの編集差分を収集し、将来的に Whisper や GPT 等の精度向上に役立てる機能。Videdit パイプラインにおいて **データ収集・加工層（DiffCollector）の実装を完了済み** であり、`projects/_learning/training_data.json` への蓄積および Whisper 用エクスポートが可能です。自動学習フェーズのみが将来の課題として残されています。
