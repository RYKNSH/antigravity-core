# Persona Orchestration System: Architectural Overview

## 1. Vision & Purpose
単一のAI視点では気づけない「盲点」を、専門化された複数のペルソナ（Persona）による「議論（Debate）」を通じて発見し、成果物の品質を飛躍的に向上させる。また、成果物への貢献度に基づいてペルソナを動的に進化させる「自然淘汰型」の管理システムを構築する。

## 2. Core Mechanism: The Debate Loop
1.  **HR Director (Meta-Persona)**: タスクを5軸（Target, Risk, Emotion, Action, Domain）で分析し、最適なチームを編成。
2.  **Sequential Critique**: 各ペルソナが専門視点から独立した初期見解を提示。
3.  **Mutual Counter-argument**: 他のペルソナの主張に対して反論・補強・譲歩を行うAgent Teams型議論。
4.  **Synthesis**: 全ての議論を統合した最終提案（Debate Version）を作成。

## 3. Implementation Patterns

### Pattern: Multi-Persona Debate
メインエージェントが内部的に「帽子を掛け替え」、一連のシミュレートされたやりとりを生成する。
- **Standard**: 3-5名のペルソナによる基本セッション。
- **Team Review**: 相互反論と合意形成を重視した設計/コードレビューモード。
- **Quick**: Skeptic + 専門家1名による最小構成。

### Pattern: Proactive Recruitment
タスクの性質に応じて、既存のライブラリにいない視点を Ad-hoc ペルソナとして即席生成し、議論に加える。

## 4. Integration Points
- **System Workflow**: `/debate` コマンドにより明示的に起動。
- **Proactive Suggestion**: `/checkpoint_to_blog` 等の他ワークフローの構成要素として自動挿入。
