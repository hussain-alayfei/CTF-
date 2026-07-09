#!/usr/bin/env python3
"""
Day 5 (Privacy) v4 generator.

Builds the anti-AI privacy pack: mostly live/interactive browser challenges plus
exactly two file-based ones (the existing places.sqlite bookmark vault, kept as
is, and one image forensics challenge generated here). Computes all crypto
material so the browser JS and the database agree, generates the image artifact
with hidden EXIF metadata, and emits the matching migration.

Reveal model for the fingerprint challenges: the answer is stored ONLY as
ciphertext in challenge_live_material, XORed with a SHA-256 keystream derived
from the canonical environment string. It decrypts only inside a browser that
genuinely matches — never in the JS bundle or the RPC response.

Run:  python scripts/gen-day5-privacy.py
Then re-apply the emitted migration (keys for the image challenge are random per
run).
"""
import hashlib
import os
import secrets
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DAY5_DIR = os.path.join(ROOT, "public", "challenges", "day5")
MIG_DIR = os.path.join(ROOT, "supabase", "migrations")
os.makedirs(DAY5_DIR, exist_ok=True)


def sha256(s: str) -> bytes:
    return hashlib.sha256(s.encode("utf-8")).digest()


def xor_hex(plaintext: str, key: bytes) -> str:
    pb = plaintext.encode("utf-8")
    return bytes(pb[i] ^ key[i % len(key)] for i in range(len(pb))).hex()


def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


# ---------------------------------------------------------------- answers
ANS = {
    "p5_ghost_profile": "kiosk_admitted",
    "p5_referer_burn": "leak_via_referer",
    "p5_metadata_mirage": "north_dock_gate",
    "p5_cookie_jar": "tier_escalated",
    "p5_entropy_portal": "blend_into_crowd",
    "p5_supercookie": "evercookie_rebuilt",
    "p5_reidentified": "subject_relinked",
}

# ---------------------------------------------------------------- material
# M1 Ghost Profile — canonical env "timezone|locale|screen"
GHOST = {"timezone": "Europe/London", "locale": "en-GB", "screen": "1280x720"}
ghost_canon = f"{GHOST['timezone']}|{GHOST['locale']}|{GHOST['screen']}"
ghost_reveal = xor_hex(ANS["p5_ghost_profile"], sha256(ghost_canon))

# H1 Entropy Portal — canonical env "timezone|locale|screen|scheme|dpr"
ENTROPY = {
    "timezone": "America/New_York",
    "locale": "en-US",
    "screen": "1920x1080",
    "scheme": "light",
    "dpr": "1",
}
entropy_canon = "|".join(
    [ENTROPY["timezone"], ENTROPY["locale"], ENTROPY["screen"], ENTROPY["scheme"], ENTROPY["dpr"]]
)
entropy_reveal = xor_hex(ANS["p5_entropy_portal"], sha256(entropy_canon))

# M4 Cookie Jar — canonical posture "tier|consent"
cookie_canon = "member|revoked"
cookie_reveal = xor_hex(ANS["p5_cookie_jar"], sha256(cookie_canon))

# M2 Referer Burn — 3 fragments assembled in seq order -> answer
referer_frags = {"p1": "leak", "p2": "_via_", "p3": "referer"}
assert "".join([referer_frags["p1"], referer_frags["p2"], referer_frags["p3"]]) == ANS["p5_referer_burn"]

# H2 Supercookie — 5 fragments in vector order cookie/local/session/idb/cache
super_frags = {
    "seg_cookie": "ever",
    "seg_local": "cookie",
    "seg_session": "_re",
    "seg_idb": "buil",
    "seg_cache": "t",
}
assert "".join(
    [super_frags["seg_cookie"], super_frags["seg_local"], super_frags["seg_session"],
     super_frags["seg_idb"], super_frags["seg_cache"]]
) == ANS["p5_supercookie"]

# M3 Metadata Mirage — image ciphertext XOR off-file session key = answer
mirage_key = secrets.token_bytes(48)  # high entropy, >= plaintext length
mirage_key_hex = mirage_key.hex()
mirage_cipher_hex = xor_hex(ANS["p5_metadata_mirage"], mirage_key)

# D1 Re-Identified — unique linkage confirmed server-side
reident = {"anon_id": "A-7731", "public_id": "V-2050"}


# ---------------------------------------------------------------- image
def build_mirage_image():
    from PIL import Image, ImageDraw
    import piexif

    W, H = 900, 600
    img = Image.new("RGB", (W, H), (24, 30, 26))
    d = ImageDraw.Draw(img)
    # A vague "dock at night" scene with an obviously blurred/blacked-out sign.
    d.rectangle([0, 380, W, H], fill=(15, 20, 17))
    for x in range(0, W, 60):
        d.line([(x, 380), (x, H)], fill=(30, 40, 34), width=1)
    d.rectangle([300, 150, 600, 300], fill=(40, 46, 42))  # the sign
    d.rectangle([320, 190, 580, 260], fill=(20, 24, 22))  # redacted bar over the sign
    d.text((330, 120), "PORT ACCESS  (location scrubbed before upload)", fill=(120, 140, 128))
    d.text((330, 215), "  [ REDACTED ]", fill=(90, 100, 94))

    thumb = img.resize((160, 120))
    thumb_path = os.path.join(DAY5_DIR, "_thumb.jpg")
    thumb.save(thumb_path, "JPEG", quality=70)
    with open(thumb_path, "rb") as fh:
        thumb_bytes = fh.read()
    os.remove(thumb_path)

    zeroth = {
        piexif.ImageIFD.Make: b"PixelPurge",
        piexif.ImageIFD.Model: b"AutoScrub 2.4",
        piexif.ImageIFD.Software: b"PixelPurge location-remover",
        # The "mirage": the exporter stripped the visible sign but left a note in
        # the metadata. It is ciphertext — meaningless without the page key.
        piexif.ImageIFD.ImageDescription: (
            "residual-export-note;xor=" + mirage_cipher_hex
        ).encode("ascii"),
    }
    # GPS present as flavour/story (the "removed" location still lingers).
    gps = {
        piexif.GPSIFD.GPSLatitudeRef: b"N",
        piexif.GPSIFD.GPSLatitude: [(40, 1), (39, 1), (5100, 100)],
        piexif.GPSIFD.GPSLongitudeRef: b"W",
        piexif.GPSIFD.GPSLongitude: [(74, 1), (0, 1), (2100, 100)],
    }
    exif_dict = {"0th": zeroth, "Exif": {}, "GPS": gps, "1st": {}, "thumbnail": thumb_bytes}
    exif_bytes = piexif.dump(exif_dict)
    out = os.path.join(DAY5_DIR, "metadata-mirage.jpg")
    img.save(out, "JPEG", quality=88, exif=exif_bytes)
    return out


# ---------------------------------------------------------------- migration
def build_migration():
    old_ids = [
        "p5_profile_archive", "p5_dns_whisper", "p5_tracker_ghost",
        "p5_briefing_carve", "p5_mask_match", "p5_exit_witness",
    ]
    # rows: (id, title, category, difficulty, points, sort_order, prompt, asset_url, action_url, hint)
    rows = [
        ("p5_ghost_profile", "Ghost Profile", "Web Privacy", "medium", 250, 504,
         "A secure newsroom only admits a visitor whose browser looks exactly like its shared kiosk. Make your own "
         "session present the three traits it expects, then read the intake token it hands you. Open it while logged "
         "in.", None, "/challenge/ghost-profile",
         "The kiosk judges you only by traits your browser announces about itself — change what it announces."),
        ("p5_referer_burn", "Referer Burn", "Web Privacy", "medium", 275, 505,
         "A free news site quietly hands your reading identity to advertising partners the instant you share an "
         "article, and shows you nothing on screen. Watch what actually leaves your browser and rebuild the "
         "identifier the partners just learned. Open it while logged in.", None, "/challenge/referer-burn",
         "The page stays quiet; the things it sends out do not."),
        ("p5_metadata_mirage", "Metadata Mirage", "Browser Forensics", "medium", 290, 506,
         "A leaked site photo had its location 'removed' before publishing. The picture looks scrubbed, but the file "
         "remembers more than the image shows. Recover the note the export tool left behind — you will also need the "
         "session value shown on this challenge page.",
         "/challenges/day5/metadata-mirage.jpg", "/challenge/verify/p5_metadata_mirage",
         "A photo is more than its pixels, and the note it left needs the key only this page holds."),
        ("p5_cookie_jar", "Cookie Jar", "Web Privacy", "medium", 305, 507,
         "A data-broker portal decides what it shows you entirely from cookies on your own machine, and never "
         "re-checks with its server. Convince it you are a member who has withdrawn consent, then read your full "
         "dossier. Open it while logged in.", None, "/challenge/cookie-jar",
         "Everything it trusts about you is sitting in your own browser, and it is editable."),
        ("p5_entropy_portal", "Entropy Portal", "Anonymity", "hard", 440, 508,
         "A whistleblower drop only opens for a visitor who cannot be singled out — one who looks like everyone else. "
         "Your session stands out on several traits at once. Blend into the crowd baseline completely, all at the "
         "same time, and the drop unseals. Open it while logged in.", None, "/challenge/entropy-portal",
         "Here you want to be boringly ordinary — on every trait at once, not just one."),
        ("p5_supercookie", "Supercookie", "Web Privacy", "hard", 470, 509,
         "A tracker that refuses to die copies your visitor id into every corner of the browser it can reach, so "
         "clearing one place never forgets you. Let it tag you, then prove how thoroughly by rebuilding your id from "
         "every hiding place. Open it while logged in.", None, "/challenge/supercookie",
         "One place is easy to clear; this thing never keeps everything in one place."),
        ("p5_reidentified", "Re-Identified", "Data Privacy", "danger", 600, 510,
         "A hospital released an 'anonymised' patient dataset — names removed, but age, postal code and gender kept. "
         "A public roll lists real names with those same details. Most patients hide inside a crowd who share their "
         "details; exactly one does not. Re-identify that single person and confirm the link. Open it while logged "
         "in.", None, "/challenge/re-identified",
         "Anonymised is not anonymous when a few ordinary details line up for only one person."),
    ]

    material = {
        "p5_ghost_profile": {**GHOST, "reveal_hex": ghost_reveal},
        "p5_referer_burn": referer_frags,
        "p5_metadata_mirage": {"session_key_hex": mirage_key_hex},
        "p5_cookie_jar": {"reveal_hex": cookie_reveal},
        "p5_entropy_portal": {**ENTROPY, "reveal_hex": entropy_reveal},
        "p5_supercookie": super_frags,
        "p5_reidentified": reident,
    }

    import json

    lines = []
    lines.append("-- Day 5 (Privacy) v4 — anti-AI rewrite of the medium/hard/danger tier.")
    lines.append("-- Mostly live/interactive browser challenges; only 2 file-based (bookmark")
    lines.append("-- vault sqlite kept + metadata-mirage image). Generated by")
    lines.append("-- scripts/gen-day5-privacy.py (keys random per run — re-apply if regenerated).")
    lines.append("begin;")
    lines.append("")
    all_removed = old_ids + ["p5_reidentified"]
    inlist = ", ".join(sql_str(i) for i in all_removed)
    lines.append(f"delete from public.submission_attempts where challenge_id in ({inlist});")
    # solves / hints / answer_keys / hint_unlocks cascade from challenges FK.
    lines.append(f"delete from public.challenges where id in ({inlist});")
    lines.append("")

    for (cid, title, cat, diff, pts, so, prompt, asset, action, hint) in rows:
        bonus = 100 if diff == "danger" else 50
        asset_sql = sql_str(asset) if asset else "null"
        lines.append(
            "insert into public.challenges (id, title, category, difficulty, points, first_blood_bonus, "
            "sort_order, prompt, asset_url, action_url, num_hints, day, is_extra, is_dynamic) values ("
        )
        lines.append(
            f"  {sql_str(cid)}, {sql_str(title)}, {sql_str(cat)}, {sql_str(diff)}, {pts}, {bonus}, {so},"
        )
        lines.append(f"  {sql_str(prompt)},")
        lines.append(f"  {asset_sql}, {sql_str(action)}, 1, 5, false, true);")
        secret = secrets.token_hex(16)
        mat = material.get(cid)
        mat_sql = sql_str(json.dumps(mat)) + "::jsonb" if mat else "null"
        lines.append(
            "insert into public.challenge_answer_keys (challenge_id, answer, secret, live_material) values ("
            f"{sql_str(cid)}, {sql_str(ANS[cid])}, {sql_str(secret)}, {mat_sql});"
        )
        lines.append(
            "insert into public.challenge_hints (challenge_id, hint_number, body, penalty) values ("
            f"{sql_str(cid)}, 1, {sql_str(hint)}, 40);"
        )
        lines.append("")

    # verify_reident RPC — server-gated linkage for the danger challenge.
    lines.append("""create or replace function public.verify_reident(p_player_id uuid, p_token uuid, p_anon text, p_public text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_mat jsonb; v_ans text; v_starts timestamptz; v_ends timestamptz; v_day int;
begin
  if not public._verify_player(p_player_id, p_token) then
    return jsonb_build_object('ok', false, 'message', 'Session invalid - please register again.');
  end if;
  select starts_at, ends_at into v_starts, v_ends from public.event_config where id = 1;
  if v_starts is null or now() < v_starts then
    return jsonb_build_object('ok', false, 'message', 'The event has not started yet.');
  end if;
  if v_ends is not null and now() > v_ends then
    return jsonb_build_object('ok', false, 'message', 'Time is up - the event has ended.');
  end if;
  select day into v_day from public.challenges where id = 'p5_reidentified';
  if v_day is null or not exists (select 1 from public.days d where d.day = v_day and d.is_open) then
    return jsonb_build_object('ok', false, 'message', 'This challenge is locked right now.');
  end if;
  select live_material, answer into v_mat, v_ans from public.challenge_answer_keys where challenge_id = 'p5_reidentified';
  if v_mat is null then return jsonb_build_object('ok', false, 'message', 'Unknown challenge.'); end if;
  if upper(btrim(p_anon)) = upper(v_mat->>'anon_id') and upper(btrim(p_public)) = upper(v_mat->>'public_id') then
    return jsonb_build_object('ok', true, 'token', v_ans, 'message', 'Linkage confirmed.');
  end if;
  return jsonb_build_object('ok', false, 'message', 'No unique linkage - those two records are not a confident match.');
end; $$;""")
    lines.append("grant execute on function public.verify_reident(uuid,uuid,text,text) to anon, authenticated;")
    lines.append("")
    lines.append("commit;")

    ts = datetime.now().strftime("%Y%m%d_%H%M")
    path = os.path.join(MIG_DIR, f"{ts}_rewrite_day5_privacy_v4.sql")
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(lines) + "\n")
    return path


if __name__ == "__main__":
    img = build_mirage_image()
    mig = build_migration()
    print("image  ->", img)
    print("migration ->", mig)
    print("\nAnswer map:")
    for cid, a in ANS.items():
        print(f"  {cid:20s} {a}")
    print("\nMetadata Mirage session key (hex):", mirage_key_hex)
    print("Metadata Mirage cipher (in EXIF ImageDescription):", mirage_cipher_hex)
