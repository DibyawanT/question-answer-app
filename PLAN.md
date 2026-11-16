# Plan: ADHD-fit upgrades

Picked from the Gemini notes by impact for a one-person app. Everything is derived from the
existing `attempts` and `drills` tables, so there is no new state to get out of sync.

| # | Change | Where |
|---|---|---|
| 1 | **Rounds of 5.** The 20-question drill becomes 4 short rounds with a reward screen between them and a "stop here, it's saved" exit. | `Practice.tsx`, `Home.tsx` |
| 2 | **Streak freezes.** Every 7th day in a row earns a freeze (max 2). A missed day spends one instead of resetting. Plus longest streak and a 7-day row of dots. | `drill.ts`, `db.ts`, `Home.tsx` |
| 3 | **XP and levels.** 10 XP right, 2 XP wrong (showing up counts), 20 XP per finished drill, level every 500. About 1 day in 7 is a surprise golden day with double XP. Shown on Home and reward screens only, never during a question. | `scoring.ts`, `drill.ts`, `Home.tsx`, `Practice.tsx` |
| 4 | **Real spaced repetition.** A missed question returns after 2 days, then again 7 days after you get it right. Two rights in a row retire it. (Was: one right answer and it never came back.) | `drill.ts` |
| 5 | **Gentler feedback.** Amber instead of red for a miss, "Not yet" wording, a pop on the right option, a haptic tap on Android. | `Practice.tsx`, `styles.css` |

## Skipped on purpose

| Idea | Why | Add when |
|---|---|---|
| Adaptive difficulty | Questions have no difficulty field; the drill already weights weak topics. | The banks carry a `difficulty`. |
| Leaderboards, friend boosts | One user. | Never, unless it goes multi-user. |
| Streak repair, weekend-off mode | Freezes already cover missed days. | Freezes prove too stingy. |
| Sound effects | Needs a mute setting to not be annoying. | You ask for it. |
| User table + event log | `attempts` already is the append-only log. | Multi-user. |
