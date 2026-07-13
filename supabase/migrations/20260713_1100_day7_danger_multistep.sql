-- Day 7 Danger multi-step upgrade (answers unchanged; 0 solves at authoring).
-- Adds seal/gate live marks + refreshed prompts/hints.

update public.challenge_answer_keys
   set live_material = jsonb_build_object(
     'reveal_hex', 'f1edeb1ee66ec2b782b0a22fd6c3e9',
     'seal', 'R7-SEAL'
   )
 where challenge_id = 'd7_inherited_trust';

update public.challenge_answer_keys
   set live_material = jsonb_build_object(
     'reveal_hex', '0f8862827f7ded2aaec38b81e5b0',
     'gate', 'n0rigin'
   )
 where challenge_id = 'd7_cross_talk';

update public.challenges
   set prompt = 'This desk merges visitor settings into its own config. It swears it blocked the one dangerous key everyone knows about. Taking the chief seat is only half the job — the vault still wants a second inherited mark before it opens.'
 where id = 'd7_inherited_trust';

update public.challenges
   set prompt = 'The desk ignores elevates from its own origin — too many forged widgets. Open a channel from a speaker with no origin, read the gate the desk posts back, then confirm from that same kind of speaker.'
 where id = 'd7_cross_talk';

update public.challenges
   set prompt = 'Arm the desk first. Then a guest may reserve a seat — but confirm only works if who you are now is not who you were when you reserved, the one-shot ticket still matches, and you finish before the desk forgets.'
 where id = 'd7_flash_seat';

update public.challenge_hints
   set body = 'One famous key is blocked. The seat and the seal are two different inherited marks — the console only shows the second after the first lands.'
 where challenge_id = 'd7_inherited_trust' and hint_number = 1;

update public.challenge_hints
   set body = 'Same-origin chatter is ignored. Open the channel first, read what the desk posts back, then speak again in the confirm shape.'
 where challenge_id = 'd7_cross_talk' and hint_number = 1;

update public.challenge_hints
   set body = 'Arm, then reserve while ordinary. Confirm only after the lasting mark has flipped — and do it before the short window and the one-shot ticket both expire.'
 where challenge_id = 'd7_flash_seat' and hint_number = 1;
