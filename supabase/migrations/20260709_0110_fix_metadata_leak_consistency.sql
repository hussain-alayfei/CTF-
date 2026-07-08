-- Fix p5_metadata_leak: the artifact's GPS coordinates resolved to a real
-- city, and the prompt/hint referenced "preparation location" while the
-- actual answer key is built from the internal briefing name in the XP
-- Comment field, not GPS. Removed GPS from the artifact and aligned the
-- prompt/hint with what the file actually contains.

update public.challenges set prompt =
  'A sanitized media export removed visible references, but file metadata still leaks both the internal briefing name and the operator codename. Recover both fields and submit in lowercase with underscores.'
where id = 'p5_metadata_leak';

update public.challenge_hints set body =
  'Ignore the technical fields. Two human-written fields matter: the internal briefing name and the author codename. Submit them together, lowercase, joined by an underscore.'
where challenge_id = 'p5_metadata_leak' and hint_number = 1;
