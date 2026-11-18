# XAT Prep: project guide for Claude

A one-person XAT study app (installable on Android as a PWA). It is also the **template for future study apps** in other subjects, so this file explains how and why things are done, not only what exists.

## Keep this file current (rule)

Whenever a feature, component, endpoint, table, env var or deploy step is added or changed, update this file **in the same change**:
1. Add a row to **Feature log** (date, what, files).
2. Update the section it touches (data model, API, mechanics, deploy).
3. If the idea was skipped on purpose, add it to **Skipped on purpose** with "add when".

## Git: no AI attribution (rule)

Never add `Co-Authored-By: Claude …`, "Generated with Claude Code" or any similar AI credit line to commit messages, PR descriptions, code comments or docs. Plain messages only.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Front end | React 19 + Vite 8, plain CSS, no router, no state lib | Five tabs fit in one `useState` |
| Maths | KaTeX (`web/src/Tex.tsx`): `$…$` in bank text is rendered as maths | Fast, trusted (Khan Academy), no layout jump |
| Server | Hono on Node 24, run as `.ts` directly (Node strips types, no build step) | One small file of routes |
| DB | SQLite via built-in `node:sqlite` (`DatabaseSync`) | No DB server, one file, easy backup |
| Push | `web-push` + service worker `web/public/sw.js` | Reminders on Android without an app store |
| Tests | Vitest, all logic tests in `server/logic.test.ts` | Pure functions, no fixtures |
| Hosting | Docker Compose (app + Caddy) on AWS Lightsail Mumbai | Caddy gives free auto-HTTPS |

Dependencies are deliberately few (6 runtime). Prefer stdlib / platform features before adding one.

## Layout

```
server/index.ts     all HTTP routes; bearer auth; serves dist/ in prod
server/db.ts        schema (CREATE TABLE IF NOT EXISTS on boot), all queries, input validation
server/drill.ts     pure logic: IST dates, question picking, spaced repetition, streak, XP, reminder timing
server/importer.ts  validates uploaded question-bank JSON
server/push.ts      VAPID keys, subscriptions, 1-minute reminder tick
shared/types.ts     types + SECTIONS + MODES, used by server and web
shared/scoring.ts   exam pattern (section sizes, marking, timing), XP numbers, ROUND size
shared/mandala.ts   the 8×8×8 topic tree (goal → 8 sections → 64 topics → 512 concepts)
web/src/main.tsx    tab shell, full-screen "focus" mode, auto-reload after deploy
web/src/api.ts      fetch wrapper (adds Bearer key from localStorage)
web/src/Tex.tsx     <Tex> renders $…$ maths in question/note text with KaTeX
web/src/screens/    Home, Practice (drill + study runner), Tests, Study, Mandala, Stats, Settings
data/*.json         question banks (uploaded through Settings, not auto-loaded)
```

## Commands

```bash
npm install
npm run server      # API on :3000, restarts on change
npm run web         # Vite on :5173, proxies /api to :3000
npm test            # vitest
npm run typecheck   # tsc --noEmit
npm run build       # web → dist/
```
Local DB is `app.db` in the repo root (gitignored). Override with `DB_PATH`.

## How the important things work

- **Daily drill** (`drillFor`, `buildDrill`): 20 questions, seeded by the date so it is identical all day; ids saved in `drills` so a bank upload mid-day doesn't change it. Order: one DM caselet set, then up to 5 due revision questions, then unseen-before-seen weighted by preference × weakness. Questions sharing a `setId` stay together.
- **Rounds of 5** (`ROUND`): Practice shows a reward screen between rounds; leaving mid-drill is safe, answers are saved per question and resumed.
- **Spaced repetition** (`GAPS = [2, 7]`): a miss returns after 2 days, then 7 days after a right answer; two rights in a row retire it.
- **Streak + freezes** (`streakInfo`): replayed from history every time; every 7th day earns a freeze (max 2), a missed day spends one.
- **XP**: 10 right, 2 wrong, 20 per finished drill, level every 500; ~1 day in 7 is a seeded "golden" double-XP day.
- **Sectional tests** (`testFor`, `submitTest`): real question counts and timing, scored with XAT marking in `shared/scoring.ts`.
- **Study + Mandala**: Study tab lists topics with notes; the Mandala walks the 512-concept tree. Passing a concept's 5-question study set (4/5, `passMark`) marks it green, stored as JSON in `kv['mandala']`.
- **Stats** (`topics()`, `Stats.tsx`): per section and topic: done, accuracy, last-7-days accuracy with ↑/↓ (5+ point change, 3+ answers), time vs real exam pace (`paceFor`). "Weakest first" sorts by `smoothed` accuracy ((right+1)/(answered+2)), so tiny samples don't dominate.
- **Fix my mistakes** (`openMistakes`, `mistakeSet`, `GET /api/mistakes?section=&topic=`): an open mistake is a question whose latest attempt (any mode, test skips included) wasn't right. Stats shows counts per section/topic; tapping starts a Practice set of up to 20, oldest miss first. Answering right closes it. Separate from spaced repetition, which only feeds the daily drill.
- **Weak-spot paper** (`weakPaper`, `PAPER`, `scorePaper`, `GET /api/test/WEAK`): unlocks at 100 answered questions (Tests tab shows a progress bar until then). 25 questions: up to 10 open mistakes (weak topics first), the rest from the 5 weakest topics by `smoothed` accuracy, topped up from the whole bank. Sorted by section like the real paper, timed at each section's real pace, marked like XAT (free skips scale to 8 per 75 Part 1 questions; GK unpenalised). Runs in the normal `TestRun` screen; `section: 'WEAK'` on `TestData` and on submit.
- **Reminders**: server checks every minute; sends at 1 pm and 9 pm IST if the drill isn't done, once per slot (`reminder_log`). VAPID keys are generated once and kept in `kv`.
- **Auth**: if `APP_KEY` is set, every `/api/*` needs `Authorization: Bearer <APP_KEY>`. The user pastes the key in Settings; it lives in `localStorage`.
- **Auto-update on phone**: HTML is served `no-cache`; when the app returns to foreground and the built JS filename changed, it reloads (never mid-drill/test).
- **Backup**: Settings → Download backup (`/api/export`) dumps everything; its questions/passages/notes can be re-uploaded as a bank.

## Rules followed in this codebase

- **Derive, don't store.** Streak, XP, done-days and topic stats are computed from `attempts` + `drills`. No counters to drift out of sync.
- **Server decides correctness.** The client sends the picked index; `recordAttempt` checks it. Never trust the client's "correct".
- **All dates are IST** via `today()` in `drill.ts`. Use it, never `new Date().toISOString()` for "today".
- **Validate at the boundary.** Every POST body is checked in `db.ts`; errors return `{ error }` and `reply()` turns that into a 400.
- **Pure logic lives in `drill.ts` / `shared/`** so it can be unit-tested without a DB. New logic with a branch gets a test in `logic.test.ts`.
- **Schema changes**: add `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` in `db.ts`. There is no migration tool; for a column change on an existing table, write a one-off `ALTER TABLE` guarded by a check.
- **Deliberate shortcuts** are marked with a `ponytail:` comment naming the limit and the upgrade path.
- ADHD-friendly UX: short rounds, gentle "Not yet" (amber, not red), no tab bar during focus mode, rewards shown only between questions.

## Recipes

| To add… | Do this |
|---|---|
| An API endpoint | Route in `server/index.ts` → function in `db.ts` returning data or `{ error }` → type in `shared/types.ts` if the web uses it |
| A screen | `web/src/screens/X.tsx`, add to `TABS` in `main.tsx` (or open it with `setFocus` for full-screen) |
| A table | `CREATE TABLE IF NOT EXISTS` in `db.ts`; add it to `exportAll()` so backups include it |
| Questions | JSON file in `data/` (format in README), upload via Settings. `answer` is 0-based. Same id = update. Maths as `$LaTeX$` (`\\frac` in JSON) |
| Text that may hold maths | Wrap it in `<Tex>{text}</Tex>` |
| A setting the user tunes | Small key/value → `kv` table via `kvGet`/`kvSet` |
| An env var | Read in server code, add to `.env.example`, `docker-compose.yml` `environment:`, and this file |

## Deployment

Push to `main` → GitHub Actions (`.github/workflows/deploy.yml`):
1. **test** job: `npm ci`, `npm test`, `npm run typecheck`, `npm run build`. Also runs on PRs.
2. **deploy** job (only after test passes, not on PRs): SSHes to the Lightsail server as `ubuntu`. That SSH key is locked in `authorized_keys` to run only `deploy.sh`.
3. `deploy.sh` on the server: `git pull --ff-only` → `docker compose up -d --build` → prunes old images → polls the app for up to 60 s and prints `Deployed <commit>`, or dumps logs and fails.

Server pieces: `Dockerfile` (two-stage, Node 24 slim, runs as `node` user, DB at `/data/app.db`), `docker-compose.yml` (project name fixed to `xat-prep` so the `xat-prep_data` volume survives), `Caddyfile` (auto-HTTPS for `$DOMAIN`, gzip, proxy to `app:3000`).

- Server `.env`: `APP_KEY`, `DOMAIN` (`<ip-with-dashes>.sslip.io`). Optional `VAPID_SUBJECT`.
- GitHub secrets: `LIGHTSAIL_HOST`, `LIGHTSAIL_SSH_KEY`, `LIGHTSAIL_KNOWN_HOSTS`. If `LIGHTSAIL_HOST` is missing the deploy step just skips.
- Server reads the repo with a read-only GitHub deploy key.
- Logs: `cd ~/xat-prep && docker compose logs --tail 50 app`.
- Full first-time setup is step by step in `README.md` → "Deploy to AWS".

## Reusing this as a template for another subject

Change these, keep everything else:

| File | What to change |
|---|---|
| `shared/types.ts` | `SECTIONS` |
| `shared/scoring.ts` | `XAT` section names/counts, `MARKING`, timing; rename the constant |
| `shared/mandala.ts` | `TREE` text (8 sections × 8 topics × 8 concepts, `[bank-topic]` links to question topics) and the root goal |
| `server/drill.ts` | `today()` time zone, `REMINDER_HOURS`; the "one DM caselet first" rule in `buildDrill` is XAT-specific |
| `server/push.ts` | reminder text |
| `data/` | new question banks |
| `web/public/manifest.webmanifest`, icons, `web/index.html` | app name and icons |
| `README.md`, this file | name, domain, repo URL |

## Feature log

| Date | Feature | Files |
|---|---|---|
| 2026-11-14 | MVP: daily drill, sectional tests, study notes, stats, push reminders, import/export | all |
| 2026-11-17 | GitHub Actions test-and-deploy to Lightsail | `.github/workflows/deploy.yml`, `deploy.sh` |
| 2026-11-17 | Rounds of 5, streak freezes, XP + golden days, spaced repetition, gentler feedback | `drill.ts`, `scoring.ts`, `Practice.tsx`, `Home.tsx` |
| 2026-11-18 | Mandala: 512-concept tree, pass a concept's study set to turn it green (uncommitted) | `shared/mandala.ts`, `Mandala.tsx`, `Study.tsx`, `db.ts`, `index.ts` |
| 2026-11-18 | Robust stats (smoothed weakness, 7-day trend, pace) + "Fix my mistakes" quizzes from Stats | `scoring.ts`, `drill.ts`, `db.ts`, `index.ts`, `types.ts`, `Stats.tsx`, `main.tsx` |
| 2026-11-18 | Weak-spot paper: mixed 25-Q paper from weakest topics + open mistakes, unlocks at 100 answers | `scoring.ts`, `db.ts`, `types.ts`, `Tests.tsx`, `styles.css` |
| 2026-11-18 | Banks 8–10 (103 Q): GK with 2026 current affairs, para-summary/poem/probability, top-up for strong and middle topics; rewritten notes for the 9 thin topics (a note upload replaces the old note for that topic) | `data/bank-8-gk.json`, `data/bank-9-thin.json`, `data/bank-10-topup.json` |
| 2026-11-19 | Bulk upload: Settings drop zone takes many bank files at once (drag or tap), uploads them one by one in name order, shows a result per file | `Settings.tsx`, `styles.css` |
| 2026-11-18 | KaTeX maths rendering; 177 formulas in the banks converted to `$…$` (re-upload banks to see them) | `Tex.tsx`, `Practice.tsx`, `Tests.tsx`, `data/*.json`, `README.md` |

## Skipped on purpose

See `PLAN.md` → "Skipped on purpose" (adaptive difficulty, leaderboards, sound, multi-user). Add new ones there.

Known limits: weak-spot paper scores aren't kept as a history (only the attempts are); add a `papers` table when a score trend is wanted. An in-progress sectional test lives only in memory (reload loses it); `summary()` scans all drills each call (fine for one user); bank questions were written by Claude, so expect a few errors ("Report a problem" stores reports in the backup). GK current affairs in `bank-8-gk.json` are as of mid-November 2026 (from web news); recheck repo rate, Gaganyaan G1 and office-holders before the exam. KaTeX is in the main bundle (~75 KB gz); lazy-load it if first load gets slow. Graphs/charts (Mafs, Chart.js) skipped until a question needs one.
