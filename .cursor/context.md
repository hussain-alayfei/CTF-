# KGSP CTF — Project Context (for AI agents & devs)

This file gives future agents the mental model needed to make changes safely.
Update it whenever the architecture, schema, or conventions change.

## Stack

- **Frontend:** Vite + React 18 + TypeScript + Tailwind CSS (SPA)
- **Backend:** Supabase (Postgres + RLS + Realtime). **No Supabase Auth.**
- **Hosting:** Vercel (SPA rewrite to `index.html`)
- **Supabase project id:** `xehzdlfrzlokwvtcfvjx`

## Identity model (important)

There is **no Supabase Auth**. Instead:

- **Players** register with username + password + emoji avatar. Passwords are
  bcrypt-hashed (`extensions.crypt`). Each player gets a secret `token` (uuid).
  All player mutations go through `SECURITY DEFINER` RPCs that verify the token.
- **Admins** share one account: username `KGSP_CTF_ADMIN`, password `KGSP_CTF_ADMIN`.
  `admin_login(username, password)` returns the `admin_config.secret` as a session
  token. Every `admin_*` RPC takes that secret. The frontend stores it in React
  state only (not localStorage).
- Flags & hints live in tables with **RLS enabled but no SELECT policy**, so clients
  can never read them — only the RPCs can.

## Database

### Key tables
- `players` — id, username, token, password_hash, avatar, created_at
- `challenges` — id, title, category, difficulty, points, first_blood_bonus,
  sort_order, prompt, asset_url, action_url, num_hints, **day**, **is_extra**,
  **suggested_tool**
- `challenge_flags` — challenge_id, flag (SECRET)
- `challenge_hints` — challenge_id, hint_number, body, penalty (SECRET)
- `solves` — player_id, challenge_id, points_awarded, is_first_blood, solved_at
- `hint_unlocks` — records penalties per player/challenge/hint
- `submission_attempts` — rate limiting
- `days` — day, title, subtitle, is_open, event_label, sort_order, is_rest, requires_code
- `day_codes` — day, code (SECRET; RLS no-policy)
- `event_config` — id=1, name, starts_at, ends_at, duration_minutes, freeze_minutes
- `admin_config` — id=1, secret, username, password_hash
- `leaderboard` (view) — player_id, username, avatar, total_points, solves_count, last_solve_at

### Key RPCs
Player: `register_player(username,password,avatar)`, `login_player(username,password)`,
`submit_flag(...)`, `unlock_hint(...)` (free once solved), `check_day_code(day,code)`.

Admin (all take the secret token from `admin_login`): `admin_login`, `admin_overview`,
`admin_start_event`, `admin_stop_event`, `admin_reset`, `admin_set_day`,
`admin_set_freeze`, `admin_set_day_code`, `admin_list_players`, `admin_delete_player`.

> pgcrypto lives in the `extensions` schema — always call `extensions.crypt` /
> `extensions.gen_salt` inside functions that set `search_path = public, pg_temp`.

## Day / challenge structure

- Challenges belong to a **day**; each day holds both its labs and any bonus
  challenges together (there is **no** separate global bonus day).
- Current: Day 1 & 2 = rest days, Day 3 = Securing Data (code `SECURING-DATA`,
  labs + crypto/stego/hash), Day 4 = Web & Recon (cookie, chain; locked until opened).
- Prompt style: short & cryptic (Black Hat / FlagYard). No step-by-step tool names
  in prompts — those go in optional, point-penalized hints.
- **`is_extra`** (boolean): marks a challenge as optional bonus practice rather
  than core lecture content. In `Play.tsx`, each day renders its non-extra
  challenges first, then any `is_extra` ones under a separate "🎁 Extra
  Challenges" heading — still inside the same day, never a separate day.
- **`suggested_tool`** (text, nullable): a short beginner-friendly pointer to
  the *kind* of tool needed (e.g. "Any online Base64 decoder") — never the
  technique or answer. Shown in `ChallengeModal.tsx` right under the prompt,
  and in the admin challenge preview. Since players are beginners, this
  softens the otherwise cryptic Black-Hat-style prompts without spoiling
  the challenge.

## File map

```
src/
  App.tsx                  routes: / (Play), /admin (AdminPanel), /challenge/admin-panel (CookieChallenge)
  lib/
    api.ts                 all Supabase RPC + table calls
    types.ts               shared TS types
    supabase.ts            client (anon key)
    session.ts             player localStorage (kgsp_ctf_player)
    app-context.tsx        player, mute, theme context
    useGame.ts             loads challenges/days/solves/leaderboard + realtime subscriptions
    time.ts                event state (idle/running/ended) + freeze window
    sounds.ts              Web Audio synthesized cyber SFX (incl. playEventStart/End)
    theme.ts               dark/light
    constants.ts           AVATARS list
  components/
    Register.tsx           horizontal login/register (alias + password + avatar)
    ChallengeCard.tsx      grid card
    ChallengeModal.tsx     prompt, hints (free once solved), flag submit
    Leaderboard.tsx        ranked list with avatars
    Podium.tsx             Kahoot-style 3-2-1 finale with sounds
    ProfileModal.tsx       slide-out side panel (score, rank, solves, logout)
    Timer.tsx              countdown with color states
    Toasts.tsx             live solve / first-blood announcements
    Prompt.tsx             safe markdown subset renderer
  pages/
    Play.tsx               main arena: days, code gate, event banner, GO overlay
    AdminPanel.tsx         dashboard: login, event, days+codes, players, challenges, music
    CookieChallenge.tsx    the cookie-tampering web challenge
```

## Conventions

- **Theme:** terminal palette via CSS variables in `index.css`; Tailwind colors are
  `terminal-*`. Dark mode is default (`data-theme` on `<html>`).
- **Sounds:** all synthesized in `sounds.ts` (no audio files). Respect the global mute.
- **Avatars:** emoji from `constants.ts` `AVATARS`.
- **Animations:** defined in `tailwind.config.js` (flicker, slide-down, slide-left, pop, pulse-ring, rise).
- **Realtime:** `useGame.ts` subscribes to `solves`, `players`, `event_config`, `days`.

## Adding a challenge (quick)

Insert into `challenges` + `challenge_flags` (+ optional `challenge_hints`), set its
`day`, drop any asset into `public/challenges/...`, then open that day in `/admin`.
See `ADMIN_MANUAL.md` section 7 for the exact SQL.
