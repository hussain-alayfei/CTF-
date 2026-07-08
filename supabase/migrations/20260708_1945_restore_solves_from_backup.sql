-- Restore player solves that were wiped (submission_attempts/hint_unlocks/solves
-- were cleared, likely by an admin_reset call during earlier work on 2026-07-08).
-- Source: backups/scores-backup-2026-07-08T1410Z.json, taken as a safety snapshot
-- before that day's bug-fix work. All player_ids below were verified to still
-- exist with the same usernames in the live players table. day_entries were
-- untouched by the reset and did not need restoring.
insert into public.solves (player_id, challenge_id, points_awarded, is_first_blood, solved_at) values
  ('b8a9f387-f4c0-484d-8aa1-8712ff33060b','net_pcap_creds',150,true, '2026-07-08T12:01:21.88333+00:00'),
  ('f66b44aa-ddca-4f3b-92f2-354fb2c24498','net_pcap_creds',100,false,'2026-07-08T12:01:26.47632+00:00'),
  ('6101ef02-e0ef-4d8c-a9ec-4ec95837f31e','net_pcap_creds',100,false,'2026-07-08T12:01:47.982063+00:00'),
  ('ed65a0ec-2f9d-4535-9def-cb42ebc08de8','net_pcap_creds',100,false,'2026-07-08T12:03:22.511805+00:00'),
  ('c283c772-0206-4c90-b624-389639e96906','net_carve_png', 250,true, '2026-07-08T12:05:23.85523+00:00'),
  ('b8a9f387-f4c0-484d-8aa1-8712ff33060b','net_router_live',300,true,'2026-07-08T12:06:33.5866+00:00'),
  ('72459cdf-51da-4fc3-a4f2-696b095a6b24','net_pcap_creds',80,false, '2026-07-08T12:07:58.029846+00:00'),
  ('6101ef02-e0ef-4d8c-a9ec-4ec95837f31e','net_router_live',250,false,'2026-07-08T12:08:15.259795+00:00'),
  ('c283c772-0206-4c90-b624-389639e96906','net_exif_geo',250,true, '2026-07-08T12:10:26.305017+00:00'),
  ('72459cdf-51da-4fc3-a4f2-696b095a6b24','net_exif_geo',200,false,'2026-07-08T12:10:38.816728+00:00'),
  ('72459cdf-51da-4fc3-a4f2-696b095a6b24','net_router_live',250,false,'2026-07-08T12:11:51.916619+00:00'),
  ('b8a9f387-f4c0-484d-8aa1-8712ff33060b','cookie',350,true, '2026-07-08T12:11:52.872537+00:00'),
  ('f66b44aa-ddca-4f3b-92f2-354fb2c24498','net_carve_png',160,false,'2026-07-08T12:11:56.064613+00:00'),
  ('22725337-57e7-4147-896e-66088a5d4086','net_pcap_creds',80,false, '2026-07-08T12:15:52.048277+00:00'),
  ('6101ef02-e0ef-4d8c-a9ec-4ec95837f31e','net_chain_danger',600,true,'2026-07-08T12:16:40.249833+00:00'),
  ('f66b44aa-ddca-4f3b-92f2-354fb2c24498','net_exif_geo',200,false,'2026-07-08T12:17:01.71283+00:00'),
  ('6101ef02-e0ef-4d8c-a9ec-4ec95837f31e','cookie',300,false, '2026-07-08T12:17:20.786832+00:00'),
  ('f66b44aa-ddca-4f3b-92f2-354fb2c24498','net_router_live',250,false,'2026-07-08T12:18:50.472097+00:00'),
  ('c283c772-0206-4c90-b624-389639e96906','net_pcap_creds',100,false,'2026-07-08T12:19:09.880639+00:00'),
  ('4e11f6e4-0e90-4bb6-9b4b-c724b52c069a','net_pcap_creds',80,false, '2026-07-08T12:20:37.823014+00:00'),
  ('da4697db-6c66-4174-b3be-37acbbf9d37c','net_router_live',250,false,'2026-07-08T12:21:26.532628+00:00'),
  ('c283c772-0206-4c90-b624-389639e96906','net_router_live',250,false,'2026-07-08T12:21:47.996175+00:00'),
  ('4e11f6e4-0e90-4bb6-9b4b-c724b52c069a','net_exif_geo',160,false, '2026-07-08T12:21:48.262481+00:00'),
  ('b8a9f387-f4c0-484d-8aa1-8712ff33060b','net_exif_geo',200,false,'2026-07-08T12:23:00.062166+00:00'),
  ('da4697db-6c66-4174-b3be-37acbbf9d37c','net_exif_geo',200,false,'2026-07-08T12:25:34.292867+00:00'),
  ('72459cdf-51da-4fc3-a4f2-696b095a6b24','net_pcap_hunt',400,true,'2026-07-08T12:26:04.308378+00:00'),
  ('da4697db-6c66-4174-b3be-37acbbf9d37c','net_pcap_creds',100,false,'2026-07-08T12:27:52.344186+00:00'),
  ('22725337-57e7-4147-896e-66088a5d4086','net_carve_png',200,false,'2026-07-08T12:29:36.984684+00:00'),
  ('22725337-57e7-4147-896e-66088a5d4086','net_exif_geo',200,false, '2026-07-08T12:31:29.878154+00:00'),
  ('22725337-57e7-4147-896e-66088a5d4086','net_router_live',250,false,'2026-07-08T12:33:14.615397+00:00')
on conflict (player_id, challenge_id) do nothing;
