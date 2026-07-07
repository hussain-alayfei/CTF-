# KGSP CTF — Admin Manual

A step-by-step guide for instructors running the KGSP Capture The Flag platform.
This file is written to be edited later — each section is self-contained so you can
add new content without touching the rest.

> **Tip:** To turn this into a PDF, open it in VS Code and use "Markdown PDF", or
> paste it into any Markdown-to-PDF tool.

---

## 1. Quick Start

1. Open the site and go to **`/admin`** (e.g. `https://your-site.com/admin`).
2. Sign in:
   - **Username:** `KGSP_CTF_ADMIN`
   - **Password:** `KGSP_CTF_ADMIN`
   - (All 3 admins share these credentials.)
3. You're in the **Instructor Dashboard**. From here you can start/stop the event,
   open/lock days, set day access codes, manage players, preview challenges, and
   play background music.

---

## 2. Running an Event

The dashboard's **Event control** section is the heart of a live competition.

| Action | What it does |
|--------|--------------|
| **Duration (minutes)** | How long the round runs once started. |
| **Start / restart event** | Starts the clock now. Players immediately see "Event is LIVE" + hear a start sound + a "GO!" overlay. |
| **Stop now** | Ends the event immediately for everyone. Submissions close. |
| **Reset game** | Clears ALL scores/solves and the timer. Players keep their accounts. |
| **Hide scores in final N minutes** | The "freeze" — leaderboard is hidden in the last N minutes for suspense. |

**Typical flow:**
1. Set the duration (e.g. 60).
2. Optionally set a freeze (e.g. 15).
3. Click **Start** — the room's players see the LIVE banner and the countdown.
4. When the timer hits zero, the **podium finale** auto-launches (3rd → 2nd → 1st,
   Kahoot-style, with sounds). You can also re-open it via "Show final results".

---

## 3. Managing Days

Each challenge belongs to a **day**. The dashboard's **Days** section controls them.

- **Open / Lock** — toggle whether a day's challenges are visible to players.
- **Rest days** (😴) — marked days with no challenges (Day 1 & Day 2 currently).
- **Access code** (🔐) — an optional code students must type to enter that day.
  Click **edit** next to a day to set or clear its code. Leave empty to remove it.

**Current roadmap:**

| Day | Title | Status |
|-----|-------|--------|
| 1 | 😴 Rest Day | Open, no challenges |
| 2 | 😴 Rest Day | Open, no challenges |
| 3 | 🔬 Securing Data | Open, **code-gated** (`SECURING-DATA`) — labs + crypto bonus |
| 4 | 🌐 Web & Recon | Locked until you open it — web + recon challenges |

> Every day can hold both its **labs** and **bonus** challenges together — there is
> no separate global "Bonus" section anymore.

---

## 4. Player Management

The **Players** section lists everyone who registered.

- See each player's **avatar, username, score, solves, first bloods**.
- Click a **username** to expand full details (join time + every solve).
- **Search** by username with the box at the top-right.
- **🗑 Delete** removes a player and all their solves (asks for confirmation, cannot be undone).

---

## 5. Challenges & Flags

The **Challenges & flags** section lists every challenge grouped by day.

- Click a challenge to **expand a full preview**: the exact prompt players see,
  the flag, all hints (with point penalties), and any file/action links.
- **👁 Reveal flags / 🙈 Hide flags** toggles flag visibility (keep hidden when projecting).

### Scoring rules
- Solving a challenge awards its points (minus any hint penalties you unlocked before solving).
- **First blood** on a challenge gives a bonus.
- **Hints are free once you've already solved** that challenge — no penalty after solving.

---

## 6. Competition Music

The **Competition music** section plays audio on **your device only** (for room speakers).

1. Paste a **direct audio file URL** (ending in `.mp3` or `.ogg`).
2. Click **▶ Play** (or **⏸ Pause** / **⏹ Stop**). Adjust the volume slider.
3. The URL and volume are remembered on this browser.

> Note: YouTube page links won't work — you need a direct audio file URL that allows embedding.

---

## 7. Adding New Content Later

Challenges live in the Supabase database. To add one to **any day**:

1. Open Supabase → **SQL Editor** (or ask the AI agent to do it).
2. Insert the challenge, its flag, and optional hints:

```sql
-- Challenge (metadata; not secret)
insert into public.challenges
  (id, title, category, difficulty, points, first_blood_bonus, sort_order, num_hints, day, asset_url, action_url, prompt)
values
  ('my_new_chal', 'My Challenge', 'Web', 'medium', 200, 50, 20, 2, 4, null, null,
   'Short, cryptic prompt here.');

-- Flag (SECRET)
insert into public.challenge_flags (challenge_id, flag)
values ('my_new_chal', 'KGSP{the_answer}');

-- Hints (SECRET; penalty = points off that challenge)
insert into public.challenge_hints (challenge_id, hint_number, body, penalty) values
  ('my_new_chal', 1, 'A gentle nudge.', 20),
  ('my_new_chal', 2, 'A bigger nudge.', 40);
```

3. Set `day` to the day number you want it to appear on. Open that day in the dashboard.
4. If the challenge needs a downloadable file, put it in `public/challenges/...`
   and set `asset_url` to its path (e.g. `/challenges/labs/myfile.bin`).

### Prompt style
Keep prompts **short and cryptic** (Black Hat / FlagYard style): a one-to-three
sentence scenario plus the artifact. Do **not** spell out tool names or steps —
that's what the (optional, penalized) hints are for.

---

## 8. Troubleshooting

| Problem | Fix |
|---------|-----|
| Can't sign in to `/admin` | Username and password are both `KGSP_CTF_ADMIN` (case-sensitive). |
| Players don't see a day | Make sure the day is **Open** and (if code-gated) they entered the code. |
| Scores look wrong | Use **Reset game** to clear all solves and start fresh. |
| Timer not showing for players | You must click **Start** — idle events show "Waiting to start". |
| Music won't play | Use a direct `.mp3`/`.ogg` URL; some hosts block embedding. |
| Changed the DB but UI is stale | The dashboard auto-refreshes every 5s; players get realtime updates. |

---

## 9. Reference: Credentials & Codes

- **Admin login:** `KGSP_CTF_ADMIN` / `KGSP_CTF_ADMIN`
- **Day 3 access code:** `SECURING-DATA`
- **Supabase project id:** `xehzdlfrzlokwvtcfvjx`

> Keep this file updated whenever you change codes or add days/challenges.
