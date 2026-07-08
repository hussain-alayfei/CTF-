-- Migration: permanently remove the 3 "instructor must share an IP" Day-4
-- target-box extras (Rogue Port / Tapped Wire / Rogue Resolver).
-- Applied to the live project on 2026-07-08. Each had 0 solves, so NO player
-- score is affected. The target-box/ folder was also removed from the repo.

delete from public.submission_attempts where challenge_id in ('net_extra_nmap','net_extra_sniff','net_extra_dns');
delete from public.hint_unlocks        where challenge_id in ('net_extra_nmap','net_extra_sniff','net_extra_dns');
delete from public.solves              where challenge_id in ('net_extra_nmap','net_extra_sniff','net_extra_dns');
delete from public.challenge_answer_keys where challenge_id in ('net_extra_nmap','net_extra_sniff','net_extra_dns');
delete from public.challenges          where id in ('net_extra_nmap','net_extra_sniff','net_extra_dns');
