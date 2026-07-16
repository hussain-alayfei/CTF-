# KGSP CTF — Admin Manual

A step-by-step guide for instructors running the KGSP Capture The Flag platform.
This file is written to be edited later — each section is self-contained so you can
add new content without touching the rest.

> **Tip:** To turn this into a PDF, open it in VS Code and use "Markdown PDF", or
> paste it into any Markdown-to-PDF tool.

---

## 1. Quick Start

1. Open the site and log in like any player (the normal login/register screen) with:
   - **Username:** `kasut_kgsp_ctf`
   - **Password:** `kasut_kgsp_ctf`
2. Once logged in, an **🛠 Admin** and **🖥 Board** link appear in the header — click
   **Admin** to open the Instructor Dashboard.
3. From there you can start/stop the event, set the **active day** (which resets the
   leaderboard per day), open/lock days, set day access codes, manage players,
   preview challenges, and play background music.

> There is no separate `/admin` password screen anymore — the instructor account is
> just a normal login with special privileges. Only this one account (`is_admin = true`
> in the database) sees the **🛠 Admin** and **🖥 Board** buttons in the header, which
> open the dashboard and the projector board as in-page overlays (no separate URL).
> This account is automatically excluded from the leaderboard and participant counts.

---

## 2. Running an Event

The dashboard's **Event control** section is the heart of a live competition.

| Action | What it does |
|--------|--------------|
| **Duration (minutes)** | How long the round runs once started (defaults to 35). |
| **Start / restart event** | Starts the clock now. Players immediately see "Event is LIVE" + hear a start sound + a "GO!" overlay. |
| **Stop now** | Ends the event immediately for everyone. Submissions close. |
| **Reset game** | Clears scores/solves **for the currently active day only** and the timer. Players keep their accounts. Every other day's scores are untouched. |
| **Hide scores in final N minutes** | The "freeze" — leaderboard is hidden in the last N minutes for suspense. |

**Typical flow:**
1. Set the duration (e.g. 35).
2. Optionally set a freeze (e.g. 15).
3. Click **Start** — the room's players see the LIVE banner and the countdown.
4. When the timer hits zero, the **podium finale** auto-launches (3rd → 2nd → 1st,
   one at a time with a real countdown between each reveal). You can also re-open
   it via "Show final results".

---

## 3. Active Day (the leaderboard resets per day)

The dashboard has an **▸ Active Day (Leaderboard)** section. This controls which
day's scores students see on the live leaderboard and finale — completely
independent of the event timer above.

- Pick a day from the dropdown and click **Set active day**.
- Students' leaderboard immediately updates to show only that day's scores (0 for
  everyone who hasn't solved anything yet that day) — it feels like a fresh start.
- **No scores are ever deleted.** Every past day's results stay in the database
  forever, and students can still browse them using the small day-selector dropdown
  above their leaderboard.
- Use this at the start of each new day: e.g. when Day 3 wraps up and Day 4 begins,
  switch the active day to 4 so the room sees a clean board for the new challenges.

---

## 4. Managing Days

Each challenge belongs to a **day**. The dashboard's **Days** section controls them.

- **Open / Lock** — toggle whether a day's challenges are visible to players.
- **Access code** (🔐) — an optional code students must type to enter that day.
  Click **edit** next to a day to set or clear its code. Leave empty to remove it.

**Current 10-day curriculum** (from the 2-week plan; only Day 3 has challenges so far):

| Day | Title | Status |
|-----|-------|--------|
| 1 | 🛡️ Introduction to Cybersecurity | Locked |
| 2 | 🔑 Securing Accounts | Locked |
| 3 | 🔬 Securing Data | **Open**, code-gated (`SECURING-DATA`) — live challenges |
| 4 | 📡 Securing Networks | Locked |
| 5 | 🎭 Privacy | Locked |
| 6 | 🎯 Introduction to Pentesting | Locked |
| 7 | 🌐 Web Applications | Locked |
| 8 | 💥 Web Application Hacking | Locked |
| 9 | ⛓️ Blockchain Introduction | Locked |
| 10 | 🏁 Final CTF Challenges | Locked · code `FINAL-2026` · 20 challenges |

> Every day can hold both its **core** and **extra (bonus)** challenges together —
> there is no separate global "Bonus" day.

---

## 5. Player Management

The **Players** section lists everyone who registered (the instructor account is
excluded from this list — it's for testing only, not a participant).

- See each player's **avatar, username, score, solves, first bloods**.
- Click a **username** to expand full details (join time + every solve).
- **Search** by username with the box at the top-right.
- **🗑 Delete** removes a player and all their solves (asks for confirmation, cannot be undone).
- **🗑 Delete all** wipes every player and their solves at once — asks for confirmation.

---

## 6. Challenges & Flags

The **Challenges & flags** section lists every challenge grouped by day.

- Click a challenge to **expand a full preview**: the exact prompt players see,
  the flag, and any file/action links.
- **👁 Reveal flags / 🙈 Hide flags** toggles flag visibility (keep hidden when projecting).

### Scoring rules
- Solving a challenge awards its points (minus the hint penalty if you unlocked it before solving).
- **First blood** on a challenge gives a bonus, plus plays a dramatic sound for everyone
  (see Section 8 to customize it).
- **Only one hint per challenge is ever offered**, and it always costs points — the
  player gets a confirmation warning before revealing it, so they don't waste points
  by accident. Hints are free once the player has already solved that challenge.

### Difficulty tiers
Four tiers are supported: **Easy → Medium → Hard → ☠ Danger**. Danger is the highest
tier — for the hardest, most involved challenges. It renders with a distinct
fuchsia/violet glow so it stands out immediately.

### Main vs. Extra challenges
Each challenge has an **`is_extra`** flag:
- `false` (default) — core lecture content. Shown first on the day, no special label.
- `true` — optional bonus practice. Automatically grouped under a **"🎁 Extra Challenges"**
  heading, still inside the same day (never a separate day/section elsewhere).

### Challenge descriptions — no tools, no steps
Player-facing prompts should describe **what** to find, never **how** — no tool names,
no step-by-step instructions. Players are meant to think, research, and figure out the
approach themselves. (This changed from an earlier, more guided style.) The database
still has a `suggested_tool` field, but it is intentionally **not shown to players**
anymore — keep it empty or use it purely as your own internal note if useful.

---

## 7. Competition Music

The **Competition music** section plays audio on **your device only** (for room speakers).

1. Paste a **direct audio file URL** (ending in `.mp3` or `.ogg`).
2. Click **▶ Play** (or **⏸ Pause** / **⏹ Stop**). Adjust the volume slider.
3. The URL and volume are remembered on this browser.

> Note: YouTube page links won't work — you need a direct audio file URL that allows embedding.

---

## 8. First-Blood Sound

By default, first blood plays a synthesized siren sound. To use your own sound:

1. Drop an MP3 or WAV file into `public/sounds/` in the project, named exactly:
   - `first-blood.mp3`, or
   - `first-blood.wav`
2. Deploy. The app automatically tries `first-blood.mp3` first, then `.wav`, and
   only falls back to the built-in siren if neither file is found.
3. Keep it short (2–5 seconds) and reasonably small — every player's browser
   downloads it the moment a first blood happens.

---

## 9. Presenting on a Projector

The **🖥 Board** button (in the header once logged in as admin, or the **🖥 Present
board** button inside the dashboard) opens a full-screen projector overlay right on
the arena — no separate URL:

- Large live leaderboard for the active day, a big countdown timer, and a live
  solve/first-blood feed — all synced in realtime, no manual refreshing needed.
- Just open it and share your screen; press **Esc** or **✕ Close** to return.
  Only the instructor account can open it.

---

## 10. Adding New Content Later

Challenges live in the Supabase database. To add one to **any day**:

1. Open Supabase → **SQL Editor** (or ask the AI agent to do it).
2. Insert the challenge and its flag (and an optional single hint):

```sql
-- Challenge (metadata; not secret)
insert into public.challenges
  (id, title, category, difficulty, points, first_blood_bonus, sort_order, num_hints,
   day, asset_url, action_url, prompt, is_extra)
values
  ('my_new_chal', 'My Challenge', 'Web', 'medium', 200, 50, 20, 1, 4, null, null,
   'Short, cryptic scenario + the artifact. No tool names, no steps.',
   false);                                 -- true = shows under "🎁 Extra Challenges"

-- Flag (SECRET)
insert into public.challenge_flags (challenge_id, flag)
values ('my_new_chal', 'KGSP{the_answer}');

-- Hint (SECRET; at most ONE hint per challenge; penalty = points off that challenge)
insert into public.challenge_hints (challenge_id, hint_number, body, penalty) values
  ('my_new_chal', 1, 'A nudge toward the right area — not the answer.', 40);
```

3. Set `day` to the day number you want it to appear on, and `difficulty` to one of
   `easy`, `medium`, `hard`, `danger`. Open that day in the dashboard when ready.
4. If the challenge needs a downloadable file, put it in `public/challenges/...`
   and set `asset_url` to its path (e.g. `/challenges/labs/myfile.bin`).
5. Set `is_extra = true` if it's optional bonus practice rather than core lecture content.

### Prompt style
Keep prompts **short and clean**: a one-to-two sentence scenario plus the artifact
(file, hash, ciphertext, etc.) and a clear goal. **Do not** mention tool names or
steps anywhere in the prompt — the point is for students to research and think for
themselves. `num_hints` should be `0` or `1` — never more than one hint per challenge.

---

## 11. Troubleshooting

| Problem | Fix |
|---------|-----|
| Can't see the Admin/Board links | Make sure you logged in with `kasut_kgsp_ctf` / `kasut_kgsp_ctf`. |
| Players don't see a day | Make sure the day is **Open** and (if code-gated) they entered the code. |
| Leaderboard still shows yesterday's day | Go to **▸ Active Day** and set it to today's day. |
| Scores look wrong | Use **Reset game** to clear the active day's solves and start fresh (only affects the currently active day — other days are safe; does not affect which day is Active). |
| Timer not showing for players | You must click **Start** — idle events show "Waiting to start". |
| Music won't play | Use a direct `.mp3`/`.ogg` URL; some hosts block embedding. |
| First-blood sound not customized | Confirm the file is named exactly `first-blood.mp3` (or `.wav`) inside `public/sounds/` and was deployed. |
| Changed the DB but UI is stale | The dashboard auto-refreshes every 5s; players get realtime updates. |

---

## 12. Reference: Credentials & Codes

- **Admin login:** `kasut_kgsp_ctf` / `kasut_kgsp_ctf` (log in like a normal player)
- **Day 3 access code:** `SECURING-DATA`
- **Supabase project id:** `xehzdlfrzlokwvtcfvjx`

> Keep this file updated whenever you change codes or add days/challenges.
