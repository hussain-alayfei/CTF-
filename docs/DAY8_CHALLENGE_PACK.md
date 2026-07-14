# Day 8 — Challenge Pack (design)

> **Instructor design doc.** Student-facing prompts are the “Arena prompt” blocks only.  
> Day theme: **Web Application Hacking** (walk the app · HTTP · Burp · A01 Broken Access Control).  
> Mix: **3 Easy · 4 Medium · 3 Hard · 2 Danger** = **12**. All **live browser labs**, dynamic answers.  
> Access code (proposed): **`WEBHACK-2026`** · Day number: **8**

---

## Design rules (this pack)

| Rule | How we apply it |
|------|-----------------|
| Clear goal | Every challenge ends with an explicit **Goal:** line (what to recover / unlock). |
| Anti-AI | Lab must be opened live; recovery word only appears after *doing* something in the browser / proxy. File-alone or paste-to-ChatGPT = fail. |
| Unique style | Each challenge uses a different interaction pattern (no second “change one cookie bit”, no second “swap `?id=`”). |
| Day 7 ≠ Day 8 | Day 7 already covered sequential IDOR, LFI, XSS guestbook, JWT alg:none, pollution×2, CORS, race. Day 8 goes **deeper into A01 + Burp + HTTP methods + new surfaces**. |
| Skills | Prefer manual install/use of a proxy browser, Network tab, Application storage, method/header edits — not Python one-liners. |

---

## Verdict on TA drafts (`freind_chgs.txt`)

| Draft | Keep idea? | Notes / edits |
|-------|------------|----------------|
| **Hashed ID** | **Yes → Medium** | Good “opaque IDOR”. Edit: do **not** use MD5(0)/MD5(1) textbook values (AI memorises them). Use a **short custom map** or salted prefix that only appears on the live page. Goal must say “open *another* student’s sealed report”. |
| **Cookie Bakery** | **Yes → Easy/Medium** | Classic trusted-cookie privilege. Edit: avoid full PHP serialize dump that ChatGPT rewrites instantly — use a **short structured cookie** students must edit by hand in Application → Cookies. |
| **Graph Gateway** | **Yes → Hard** | Strong. Introspection → hidden mutation. Keep multi-step; never put schema dump in the prompt. |
| **Template Trap** | **Yes → Danger (sanitized)** | SSTI→RCE is too wild for a shared classroom SPA. Keep **SSTI to read a sealed server note** (no shell, no `subclasses`). Pros still need to find the engine + escape filters. |
| **Double Agent (HPP)** | **Yes → Hard** | Excellent Burp/proxy skill, unique. Keep WAF theatre + duplicate parameter. |

Skipped from TA: pasted flags / CrackStation recipes / exact MD5(0) — those make the challenge AI-trivial.

---

## Scoreboard at a glance

| # | ID | Title | Diff | Style (unique) | Skill taught | Goal (student) |
|---|-----|-------|------|----------------|--------------|----------------|
| 1 | `d8_door_map` | Door Map | Easy | Manual walk + robots/sitemap | Recon walking | Find the staff-only door label |
| 2 | `d8_header_mirror` | Header Mirror | Easy | Read response headers | HTTP headers | Recover the desk code the server announces |
| 3 | `d8_method_gate` | Method Gate | Easy | Wrong verb → right verb | HTTP methods | Unlock the note using the allowed verb |
| 4 | `d8_cookie_lounge` | Cookie Lounge | Medium | Edit a structured cookie | Cookie trust | Open the VIP lounge plaque |
| 5 | `d8_proxy_price` | Proxy Price | Medium | Intercept & change one field | Proxy intercept | Buy the sealed item for the wrong price |
| 6 | `d8_hashed_dossier` | Hashed Dossier | Medium | Opaque-ID IDOR (live map) | Horizontal IDOR | Open the *counselor* dossier |
| 7 | `d8_step_skip` | Step Skip | Medium | Skip confirm step | Context access control | Execute without confirming |
| 8 | `d8_verb_smuggle` | Verb Smuggle | Hard | Override verb / spoof method | Method-based BAC | Delete the lock using a smuggled verb |
| 9 | `d8_twin_param` | Twin Param | Hard | Duplicate query params (HPP) | WAF vs backend | Raise role past the front gate |
| 10 | `d8_graph_attic` | Graph Attic | Hard | GraphQL introspect → mutate | API schema abuse | Promote yourself, then read the attic note |
| 11 | `d8_filter_crawl` | Filter Crawl | Danger | Path traversal through 3 filters | Advanced traversal | Read the sealed server note past all filters |
| 12 | `d8_template_vault` | Template Vault | Danger | Filtered SSTI (read-only) | Template injection | Make the profile engine print the vault line |

**Points (proposed):** Easy 100 / Medium 200 / Hard 350 / Danger 500 · first-blood +25% rounded.

---

# Easy (3)

## 1 · Door Map · `d8_door_map`

**Style:** Manual walking — no brute-force theatre.  
**Skill:** Find what search engines are told to skip; open a door that is not in the main nav.

### Arena prompt (student-facing)

```
A small campus desk app has a public lobby. Staff doors are not linked from the menu.

Walk the application the way a careful visitor would: look for maps and notices that robots are asked to ignore. One of those doors still answers if you visit it yourself.

Goal: open the staff door and recover the short label written on it.
```

**Hint (one nudge):** “Start with the notices meant for crawlers, not for people.”  
**Live behaviour:** Lobby sets nothing fancy. `/robots.txt` Disallow → `/staff-closet` (or similar). Page shows recovery word only after visit.  
**Why anti-AI:** Needs the live robots/sitemap contents (randomised path token in `live_material`).  
**Answer shape:** e.g. `staff_closet_ok`

---

## 2 · Header Mirror · `d8_header_mirror`

**Style:** Response-header hunting (not HTML comments — Day 7 already did markup).  
**Skill:** Servers talk in headers too.

### Arena prompt

```
The lobby page looks empty. The interesting part never appears in the visible layout.

Ask the desk for a fresh copy of the page and read how the server describes its own reply. One header carries a short desk code.

Goal: recover the desk code from the response metadata and submit it.
```

**Hint:** “Look at what arrives *about* the page, not the page body.”  
**Live:** Custom response header e.g. `X-Desk-Code: …` only on the challenge origin (or via a tiny fetch the page makes).  
**Why anti-AI:** Header value is minted per player / session in live material — not in HTML source dump.  
**Answer:** e.g. `desk_echo`

---

## 3 · Method Gate · `d8_method_gate`

**Style:** HTTP verb discipline.  
**Skill:** GET vs POST (and why 405 matters).

### Arena prompt

```
A sealed note endpoint refuses ordinary page loads. The UI button is broken on purpose.

Discover which request style the gate actually accepts. When you call it the right way, the note body appears.

Goal: retrieve the sealed note’s recovery word.
```

**Hint:** “The gate cares how you ask, not only where you ask.”  
**Live:** `GET /note` → 405. `POST /note` (empty body or token from page) → returns word. Students use Network replay or a simple form/fetch edit.  
**Why anti-AI:** Must observe live 405 and succeed with the correct verb against the lab.  
**Answer:** e.g. `post_only_note`

---

# Medium (4)

## 4 · Cookie Lounge · `d8_cookie_lounge` *(from TA Cookie Bakery — edited)*

**Style:** Trusted client cookie → vertical perk.  
**Skill:** Application → Cookies; decode/edit/re-encode a **short** structure (not a novel-length PHP object).

### Arena prompt

```
You are signed in as a guest on a tiny lounge site. Theme settings are stored in a cookie the server trusts too much.

Adjust that cookie so the lounge treats you as VIP. The VIP plaque appears only after the server accepts the new preference.

Goal: open the VIP plaque and recover the word printed on it.
```

**Hint:** “Preferences live in the browser. Privileges should not.”  
**Live:** Cookie like `lounge=guest.0` or compact JSON base64 — flip to VIP.  
**Edit vs TA:** No textbook PHP serialize string; no flag in prompt.  
**Answer:** e.g. `vip_plaque`

---

## 5 · Proxy Price · `d8_proxy_price`

**Style:** Intercept checkout request; change price / quantity.  
**Skill:** Install/use an intercepting proxy (or DevTools Request override) — **hands-on**, competitive “who flips the cart first”.

### Arena prompt

```
The campus shop shows a sealed item priced too high to buy with your balance.

Complete checkout anyway by changing what the browser sends when you press Buy — not by editing the visible price alone (the page redraws it).

Goal: complete a purchase of the sealed item and recover the packing slip word.
```

**Hint:** “The shelf price and the payment request are not the same thing.”  
**Live:** UI shows 9999; POST body `price=9999` must become `price=1` (server checks body, not DOM).  
**Why anti-AI:** Must hit live checkout with modified request; DOM edit alone fails.  
**Answer:** e.g. `cheap_slip`

---

## 6 · Hashed Dossier · `d8_hashed_dossier` *(from TA Hashed ID — edited)*

**Style:** Horizontal IDOR with **opaque** ids.  
**Skill:** Own dossier → discover mapping → open counselor’s.

### Arena prompt

```
Your academic dossier opens with a long opaque id in the address bar. The portal only checks that you are logged in — not that the dossier is yours.

Your own id is visible after you open “My dossier”. Somewhere on the live page, the desk also leaks how ids are chosen for staff.

Goal: open the counselor’s dossier (not your own) and recover the sealed note inside.
```

**Hint:** “Opaque is not the same as authorized.”  
**Edit vs TA:** No MD5(0)/MD5(1). Live page shows e.g. `id = prefix + studentNumber` or a tiny lookup table for *this* lab only.  
**Answer:** e.g. `counselor_file`

---

## 7 · Step Skip · `d8_step_skip`

**Style:** Context-dependent access control (slides: confirm → execute).  
**Skill:** Multi-step flow; call step 2 early.

### Arena prompt

```
Transfers require two steps: Confirm, then Execute. The Confirm button is slow on purpose.

Reach the success screen without finishing Confirm. The execute endpoint still answers if you call it directly with the transfer token from step 1’s draft.

Goal: execute the draft transfer and recover the receipt word.
```

**Hint:** “The second door does not always wait for the first.”  
**Live:** Step1 creates `draft_id`. Step2 `/execute?draft=` should require `confirmed=1` but forgets.  
**Answer:** e.g. `skipped_confirm`

---

# Hard (3)

## 8 · Verb Smuggle · `d8_verb_smuggle`

**Style:** Method-based access control bypass (slides lab list).  
**Skill:** UI only offers GET; dangerous action allowed via PUT/DELETE or `X-HTTP-Method-Override`.

### Arena prompt

```
A lockbox page shows a disabled “Clear lock” control. Normal browsing cannot clear it.

The API behind the page accepts a different request style than the button uses. Clear the lock anyway.

Goal: clear the lock and recover the word that appears when it opens.
```

**Hint:** “Buttons are suggestions. APIs decide.”  
**Live:** DELETE `/lock` or POST + `X-HTTP-Method-Override: DELETE` succeeds; GET fails.  
**Why hard:** Students must invent the verb/override, not follow a recipe.  
**Answer:** e.g. `lock_cleared`

---

## 9 · Twin Param · `d8_twin_param` *(from TA Double Agent — kept)*

**Style:** HTTP Parameter Pollution vs silly front filter.  
**Skill:** Proxy; duplicate parameters; understand front vs back disagreement.

### Arena prompt

```
Profile updates refuse the word admin when it appears alone in the role field. A loud front gate blocks that request.

The desk behind the gate reads parameters in a different order than the gate does. Deliver a request that looks safe to the gate but elevates you on the desk.

Goal: become staff on your profile and recover the staff ribbon word.
```

**Hint:** “One name, more than one value.”  
**Live:** WAF-like check on first `role=`; backend uses last `role=`.  
**Answer:** e.g. `hpp_staff`

---

## 10 · Graph Attic · `d8_graph_attic` *(from TA Graph Gateway — kept)*

**Style:** GraphQL introspection → hidden mutation → UI reveal.  
**Skill:** Network tab finds `/graphql`; schema discovery; craft mutation by hand.

### Arena prompt

```
Profiles load through a modern API. The visible card only shows public fields.

The same endpoint answers questions about its own shape. Use that to find a way to raise your account, then reload the profile — an attic note appears only for elevated accounts.

Goal: elevate your account and recover the attic note.
```

**Hint:** “Ask the API what it can do, not only what the card shows.”  
**Live:** Introspection on; mutation `setStaff(true)`; flag in elevated profile.  
**Why hard:** Multi-step; no schema in prompt; need live introspection result.  
**Answer:** e.g. `attic_note`

---

# Danger (2) — intentionally brutal

## 11 · Filter Crawl · `d8_filter_crawl`

**Style:** Path traversal with **stacked** defenses (slides labs 2–6 vibes, one challenge).  
**Skill:** Professional-grade traversal chaining — not `../etc/passwd` once.

### Arena prompt

```
A brochure viewer loads files from a folder. Simple traversal is blocked. Absolute paths are blocked. One layer strips `../` only once. Another layer cares about the start of the path. Another cares about the file ending.

Your job is to make the viewer return a sealed note that lives outside the brochure folder.

Goal: read the sealed note and submit its recovery word.
```

**Hint:** “Each gate only removes one kind of lie.”  
**Live:** Combine: strip once → double `....//`; prefix check → absolute bypass or wrapper; extension check → encoded or alternate stream style **within browser-safe lab** (no real OS escape). Recovery word only in sealed path.  
**Why danger:** Needs chaining 3+ bypass ideas; AI suggestions usually fail the *specific* filter stack.  
**Answer:** e.g. `sealed_outside`

---

## 12 · Template Vault · `d8_template_vault` *(from TA Template Trap — sanitized)*

**Style:** SSTI with denylist (no RCE, no subclass bomb).  
**Skill:** Prove template evaluation → bypass filters → read vault string from server context.

### Arena prompt

```
A profile bio claims it supports “friendly placeholders.” Some expressions are rejected. Blind shell ideas are rejected.

Make the bio renderer print a single vault line that already exists on the server context — without running system commands.

Goal: force the vault line into the rendered profile and submit that word.
```

**Hint:** “Math works. Shells do not. Look for what the engine already knows.”  
**Live:** `{{7*7}}` → 49 proves SSTI. Denylist: `class`, `mro`, `import`, `os`, `subprocess`, brackets tricks as needed. Allowed path: e.g. `{{ vault }}` or config object attribute only after discovering name via error/leak.  
**Why danger:** Filter stack + no RCE recipes from the internet work; must probe *this* engine’s allowed surface.  
**Answer:** e.g. `vault_line`

---

## Coverage vs Day 8 slides

| Slide topic | Challenge(s) |
|-------------|--------------|
| Walk app / robots / source mindset | Door Map |
| Headers | Header Mirror |
| HTTP methods / status | Method Gate, Verb Smuggle |
| Cookies | Cookie Lounge |
| Burp / intercept | Proxy Price, Twin Param |
| Horizontal IDOR | Hashed Dossier |
| Context-dependent AC | Step Skip |
| Method-based BAC | Verb Smuggle |
| Parameter tricks | Twin Param |
| APIs | Graph Attic |
| Path traversal (advanced) | Filter Crawl |
| Injection mindset (controlled) | Template Vault |

---

## Engagement / competition notes

- **Proxy Price** and **Twin Param** reward whoever gets Burp/proxy working first → loud first-blood energy.  
- **Graph Attic** / **Filter Crawl** / **Template Vault** separate the room: most finish mediums; few finish dangers.  
- Goals are always one sentence — students never wonder “what am I submitting?”

---

## Implementation notes (when you say ship)

- Day **8**, all `is_dynamic=true`, live labs under `src/challenges/day8/`, routes in `app/App.tsx`.  
- Upsert migration only; check `solves` first.  
- Update `docs/ADMIN_MANUAL_DAY8.md` with real answers + writeups (instructor only).  
- Prompts must still avoid tool/algorithm names (proxy = “change what the browser sends”; no “Burp”, “Base64”, “GraphQL introspection query” in student text — the prompts above already stay soft).  
- Danger labs: server-side filters in RPCs or edge functions — never trust the client.

---

## Proposed next step

1. You approve / tweak titles & goals.  
2. I implement Day 8 frontend labs + Supabase upsert + admin manual.  
3. Code `WEBHACK-2026`, open day when ready.
