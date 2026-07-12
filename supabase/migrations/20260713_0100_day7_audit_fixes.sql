-- Day 7 audit fixes:
-- 1) Strict Guestbook: stop shipping plaintext vault in live_material (XOR reveal only)
-- 2) Reorder sort_order so arena lists Easy → Medium → Hard → Danger

update public.challenge_answer_keys
   set live_material = jsonb_build_object('reveal_hex', 'f1acfd917ec743437b491f08')
 where challenge_id = 'd7_strict_book';

update public.challenges set sort_order = 701 where id = 'd7_markup_trail';
update public.challenges set sort_order = 702 where id = 'd7_side_door';
update public.challenges set sort_order = 703 where id = 'd7_desk_wizard';
update public.challenges set sort_order = 704 where id = 'd7_role_chip';
update public.challenges set sort_order = 705 where id = 'd7_twin_check';
update public.challenges set sort_order = 706 where id = 'd7_leaky_desk';
update public.challenges set sort_order = 707 where id = 'd7_frame_whisper';
update public.challenges set sort_order = 708 where id = 'd7_safe_shelf';
update public.challenges set sort_order = 709 where id = 'd7_stash_order';
update public.challenges set sort_order = 710 where id = 'd7_blind_lookup';
update public.challenges set sort_order = 711 where id = 'd7_strict_book';
update public.challenges set sort_order = 712 where id = 'd7_claim_ticket';
update public.challenges set sort_order = 713 where id = 'd7_inherited_trust';
update public.challenges set sort_order = 714 where id = 'd7_cross_talk';
update public.challenges set sort_order = 715 where id = 'd7_flash_seat';
