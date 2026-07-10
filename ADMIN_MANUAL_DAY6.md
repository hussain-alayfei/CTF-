# Day 6 — Introduction to Pentesting: Admin Solver Manual

> **Instructor use only.** Skeleton only — no challenges authored yet.
> Fill in the sections below once the pack is built (mirror the shape of
> `ADMIN_MANUAL_DAY4.md` / `ADMIN_MANUAL_DAY5.md`).

## Status

**Shell only.** The day row and access code already exist in the live DB
(migration `20260708_1800_initial_day_codes.sql`):

- Day 6, title "🎯 Day 6 — Introduction to Pentesting"
- Subtitle: Hacking · Phases of Hacking · Reconnaissance · Scanning ·
  Privilege Escalation · Kali Linux · nmap/metasploit · Vulnerability
  Research (NVD, CVSS)
- Day code: `PENTESTING-2026`
- `requires_code = true`, `is_open = false` (locked until instructor starts it)
- **Zero challenges exist yet** — nothing in `public.challenges` for `day = 6`.

## Why this exists (placeholder)

<!-- Once designed: one paragraph on the pack's anti-AI angle, same as Day 4/5 —
     what failure mode it's built to resist, and the honest limits. -->

## Pack summary (placeholder)

- Target mix per house style (`.cursor/context.md`): **3 easy · ~4 medium ·
  2 hard · 1 danger**, all `is_dynamic` (see Day 4/5 mechanism — answer +
  personal HMAC flag via `verify_challenge_answer`).
- Day code: `PENTESTING-2026` (already live — reuse, don't regenerate).
- Topic pool to draw from (from the day's subtitle): phases of hacking
  (recon → scan → exploit → priv-esc → cover tracks), passive vs active
  recon, nmap scan interpretation, a CVE/CVSS lookup task, a safe
  local privilege-escalation exercise, Kali tool familiarity.
- Anti-AI constraints to hold to (same hard rules as every day):
  no tool/algorithm/step names in prompts or hints, key material never
  co-located with ciphertext/artifact, no plaintext answer in any download
  or client bundle, at most one short hint per challenge.

## Answer map (placeholder — empty until authored)

| # | ID | Title | Level | Where | Answer |
|---|-----|-------|-------|-------|--------|
| — | — | — | — | — | — |

## Anti-AI notes for instructors (placeholder)

<!-- Fill in once designed: what a chatbot-paste attempt yields (should be
     nothing submittable), whether any step is server-gated, how flags are
     minted per player. -->

## SQL / generator source (placeholder)

<!-- e.g. scripts/gen-day6-pentesting.py once it exists, and the migration
     file that creates the challenges + answer keys. -->
