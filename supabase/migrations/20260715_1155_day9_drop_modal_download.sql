-- Day 9 evidence should appear only inside the open lab, not as a second
-- "Download file" button beside "Open challenge" in the arena modal.
--
-- The lab surfaces every artifact through its own evidence panel (highlighted),
-- so the challenge-level asset_url is redundant and creates a duplicate download.
-- Clearing asset_url leaves action_url intact, so the modal shows only
-- "Open challenge". Day 9 is locked with zero solves; no scores are touched.

update public.challenges
   set asset_url = null
 where day = 9
   and asset_url is not null;
