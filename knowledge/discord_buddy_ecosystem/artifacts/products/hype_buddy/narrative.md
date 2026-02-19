# Narrative: Substance > Form (Hype Buddy Development)

## The "Standee Paradox"
During the v0.4 deployment of **Hype Buddy**, a critical UX lesson was learned regarding mock-ups and hardcoded UI.

### The Problem
The dashboard initial version had a "perfect-looking" invite button that was hardcoded for visual demonstration ("After all, 120% Quality starts with a great look"). However, as the backend bot ID evolved, the button became a non-functional element—an "equal-to-life standee" (等身大パネル).

### The Betrayal
When the developer (acting as the first user) clicked the button and nothing happened, it created a sense of "interaction betrayal." It wasn't just a bug; it was an embarrassment of having interacted with a fake prompt.

### The Lesson: UI Honesty
- **Principle**: Substance over Form (AI時代はUI/UXより内容の質が大事). 
- **Action**: All hardcoded démonstration elements were replaced with real, data-driven connections to the `bot_registry`.
- **UX Truth**: A functional, plain interface is 1,000x more valuable than a beautiful but broken one. 120% Quality requires that every visible affordance is honest and responsive to the underlying system state.
