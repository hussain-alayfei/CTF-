# MERAS CTF 🚩

A beginner-friendly **Capture The Flag** platform for the Meras cybersecurity
course. Players register with a hacker alias, solve 6 challenges in a timed
1-hour event, and race up a **live leaderboard** with **first-blood** alerts and
synthesized hacker sound effects.

Built with **Vite + React + TypeScript + Tailwind** on the frontend and
**Supabase** (Postgres + Row Level Security + Realtime) on the backend. No
server to run — the whole game loop lives in secure Postgres functions.

---

## The 6 challenges

Each maps to a topic from the 2-week course. Difficulty sets the base points; the
**first person** to solve each one gets a bonus and a siren everybody hears.

| # | Difficulty | Name | Skill it teaches | Points |
|---|-----------|------|------------------|--------|
| 1 | 🟢 Easy | Not Encryption | Base64 encoding vs encryption | 100 |
| 2 | 🟢 Easy | Caesar's Secret | Caesar / ROT13 ciphers | 100 |
| 3 | 🟢 Easy | Hidden in Plain Sight | Steganography (data hidden in a file) | 150 |
| 4 | 🟡 Medium | Crack Me | Cracking a weak password hash | 250 |
| 5 | 🟡 Medium | Trust No Cookie | Why the browser can't be trusted (cookie tampering) | 300 |
| 6 | 🔴 Very Hard | The Deep Web | Recon → decode → stego, all chained together | 500 |

All flags look like `MERAS{...}`.

> **Instructors:** the full answer key (every flag + how to solve it) and your
> **admin secret** were given to you separately when this project was set up —
> they are intentionally **not** stored in this repository so students can't find
> them here.

---

## How scoring works

- **Base points** come from the difficulty (see table).
- **First blood:** the first solver of a challenge gets a bonus (+50, or +100 on
  the final boss) and a global 🩸 announcement + siren.
- **Hints cost points.** Each challenge has 1–3 hints; unlocking one subtracts
  points *from that challenge only*.
- **Rank** = total points, highest first. Ties are broken by **who reached their
  score first** (so speed matters).
- All scoring is calculated **on the server** — the browser can't fake points.

The clock is authoritative on the server too: submissions before the event
starts or after it ends are rejected, no matter what a player's computer clock
says.

---

## Run it locally

```bash
npm install
npm run dev
```

Then open the printed URL (usually http://localhost:5173). The app ships with the
Supabase connection baked in, so it works immediately. To override it, copy
`.env.example` to `.env.local` and edit the values.

```bash
npm run build   # type-check + production build (this is what Vercel runs)
npm run preview # preview the production build
```

---

## Deploy to Vercel

This repo is the whole app (nothing lives in a subfolder), so deploying is a
one-click import:

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New… → Project** → import this repo (`CTF-`).
3. Vercel auto-detects **Vite** (build `npm run build`, output `dist`). Leave the
   defaults and click **Deploy**.

Environment variables are **optional** — the public Supabase URL and anon key are
baked in as a fallback (the anon key is safe to expose; every table is protected
by Row Level Security). To set them explicitly in Vercel, add:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

After the first deploy, every push to the default branch redeploys automatically.

---

## Instructor run-sheet 🏁

1. Share the deployed URL with students. They each pick an alias and land in the
   arena (challenges are visible but locked until you start the clock).
2. Open **`/admin`** on the site, enter your **admin secret**, set the duration
   (default 60 min), and click **Start event**. The countdown syncs to everyone
   live.
3. Watch the leaderboard fill up. First bloods pop up for the whole room.
4. Need to stop early or run again? Use **Stop now** or **Reset game** on the
   same panel (reset keeps player names, clears scores, and re-arms the clock).

The admin secret lives in the Supabase table `admin_config`. You can change it
any time from the Supabase dashboard.

---

## How the backend is secured

- **Flags and hints** live in tables (`challenge_flags`, `challenge_hints`) with
  RLS enabled and **no read policy** — the browser literally cannot read them.
- **All game actions** (register, submit flag, unlock hint, admin controls) go
  through `SECURITY DEFINER` Postgres functions that validate a per-player secret
  token (or the admin secret) before doing anything.
- Players read only public data: the challenge list, the leaderboard, other
  players' names, and the event clock.
- See `supabase/schema.sql` for the full schema, policies, and functions. To
  rebuild the database on a fresh Supabase project, run `schema.sql`, then build
  your own `seed.sql` from `seed.example.sql`.

> Note: challenges 3, 5 and 6 are *designed* to reveal their flag on the client
> (that's the lesson — steganography and untrusted cookies). Their flag strings
> therefore appear in the built site by design. The other challenges' flags exist
> only in the database.
