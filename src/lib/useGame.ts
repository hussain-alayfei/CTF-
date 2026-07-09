import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import {
  fetchChallenges,
  fetchDayLeaderboard,
  fetchDays,
  fetchEventConfig,
  fetchLeaderboard,
  fetchSolves,
} from './api';
import { getCache, setCache } from './cache';
import type { Challenge, Day, EventConfig, LeaderboardRow, Player, Solve } from './types';

export interface Announcement {
  id: string;
  type: 'first_blood' | 'solve';
  username: string;
  avatar: string;
  challengeTitle: string;
  points: number;
}

export function useGame(player: Player | null) {
  // Seed from the session cache so the arena paints instantly on remount /
  // refresh; the effects below still fetch fresh data and overwrite these.
  const [challenges, setChallenges] = useState<Challenge[]>(() => getCache<Challenge[]>('challenges') ?? []);
  const [days, setDays] = useState<Day[]>(() => getCache<Day[]>('days') ?? []);
  const [solves, setSolves] = useState<Solve[]>(() => getCache<Solve[]>('solves') ?? []);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>(
    () => getCache<LeaderboardRow[]>('leaderboard') ?? [],
  );
  const [event, setEvent] = useState<EventConfig | null>(() => getCache<EventConfig>('event'));
  // If challenges are already cached we can render immediately instead of
  // flashing a loading state — the background revalidation still runs.
  const [loading, setLoading] = useState(() => getCache<Challenge[]>('challenges') == null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const challengesRef = useRef<Challenge[]>([]);
  challengesRef.current = challenges;

  // The "live" leaderboard is scoped to whichever day the admin marked active,
  // so it naturally resets when a new day begins. Falls back to the all-time
  // board if no active day has been set yet.
  const activeDayRef = useRef<number | null>(getCache<EventConfig>('event')?.active_day ?? null);

  const refreshBoard = useCallback(async () => {
    const day = activeDayRef.current;
    const [s, lb] = await Promise.all([
      fetchSolves(),
      day != null ? fetchDayLeaderboard(day) : fetchLeaderboard(),
    ]);
    setSolves(s);
    setLeaderboard(lb);
    setCache('solves', s);
    setCache('leaderboard', lb);
  }, []);

  // Debounced board refresh. Postgres Realtime fires ONE event per affected
  // row, so an admin "Reset day" (which bulk-deletes every solve for that day)
  // or "Delete all players" would otherwise trigger dozens of back-to-back
  // refetches. This coalesces any burst into a single refetch shortly after
  // the first event, keeping the leaderboard/board correct without hammering.
  const boardRefreshTimer = useRef<number | null>(null);
  const scheduleBoardRefresh = useCallback(() => {
    if (boardRefreshTimer.current != null) return; // a refresh is already queued
    boardRefreshTimer.current = window.setTimeout(() => {
      boardRefreshTimer.current = null;
      void refreshBoard();
    }, 300);
  }, [refreshBoard]);

  const refreshEvent = useCallback(async () => {
    const ev = await fetchEventConfig();
    const dayChanged = activeDayRef.current !== (ev.active_day ?? null);
    activeDayRef.current = ev.active_day ?? null;
    setEvent(ev);
    setCache('event', ev);
    if (dayChanged) void refreshBoard();
  }, [refreshBoard]);

  const refreshDaysAndChallenges = useCallback(async () => {
    const [d, ch] = await Promise.all([fetchDays(), fetchChallenges()]);
    setDays(d);
    setChallenges(ch);
    setCache('days', d);
    setCache('challenges', ch);
  }, []);

  // Initial load.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ev = await fetchEventConfig();
        if (!alive) return;
        activeDayRef.current = ev.active_day ?? null;
        const [ch, d, s, lb] = await Promise.all([
          fetchChallenges(),
          fetchDays(),
          fetchSolves(),
          activeDayRef.current != null ? fetchDayLeaderboard(activeDayRef.current) : fetchLeaderboard(),
        ]);
        if (!alive) return;
        setChallenges(ch);
        setDays(d);
        setSolves(s);
        setLeaderboard(lb);
        setEvent(ev);
        setCache('challenges', ch);
        setCache('days', d);
        setCache('solves', s);
        setCache('leaderboard', lb);
        setCache('event', ev);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Realtime subscriptions.
  useEffect(() => {
    const channel = supabase
      .channel('kgsp-ctf-game')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'solves' },
        async (payload) => {
          const s = payload.new as Solve;
          // Admin and "excluded" (test) accounts never create solve rows —
          // submit_flag verifies them but records nothing — so the live feed and
          // first-blood siren are clean by construction, with no fragile
          // client-side role check needed here.
          const ch = challengesRef.current.find((c) => c.id === s.challenge_id);
          const { data } = await supabase
            .from('players')
            .select('username, avatar')
            .eq('id', s.player_id)
            .maybeSingle();
          setAnnouncements((prev) =>
            [
              ...prev,
              {
                id: s.id,
                type: s.is_first_blood ? 'first_blood' : 'solve',
                username: data?.username ?? 'Someone',
                avatar: data?.avatar ?? '🕵️',
                challengeTitle: ch?.title ?? s.challenge_id,
                points: s.points_awarded,
              } as Announcement,
            ].slice(-30),
          );
          await refreshBoard();
        },
      )
      .on(
        // Solves are DELETED (not inserted) when an admin resets a day or
        // deletes a player. Without this, players' boards kept showing the
        // reset day's stale scores until a manual page refresh. Debounced
        // because a reset deletes many rows at once (one event each).
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'solves' },
        () => {
          scheduleBoardRefresh();
        },
      )
      .on(
        // Listen to ALL player changes, not just INSERT:
        //  - INSERT: a new registrant appears on the board.
        //  - UPDATE: an admin toggled exclude_from_board (hide/show a test
        //            account) — the board must add/drop them live.
        //  - DELETE: an admin removed a player — they must disappear for
        //            everyone, not linger until a refresh.
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        () => {
          scheduleBoardRefresh();
        },
      )
      .on(
        // A player entering a day's code becomes a competitor — refresh so they
        // appear on everyone's board (even at 0 points).
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'day_entries' },
        () => {
          void refreshBoard();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'event_config' },
        () => {
          void refreshEvent();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'days' },
        () => {
          void refreshDaysAndChallenges();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      if (boardRefreshTimer.current != null) {
        clearTimeout(boardRefreshTimer.current);
        boardRefreshTimer.current = null;
      }
    };
  }, [refreshBoard, refreshEvent, refreshDaysAndChallenges, scheduleBoardRefresh]);

  const mySolvedIds = useMemo(() => {
    const set = new Set<string>();
    if (player) for (const s of solves) if (s.player_id === player.id) set.add(s.challenge_id);
    return set;
  }, [solves, player]);

  const myPoints = useMemo(() => {
    if (!player) return 0;
    return solves
      .filter((s) => s.player_id === player.id)
      .reduce((sum, s) => sum + s.points_awarded, 0);
  }, [solves, player]);

  const firstBloodByChallenge = useMemo(() => {
    const map = new Map<string, string>();
    const fb = solves.filter((s) => s.is_first_blood);
    for (const s of fb) {
      const row = leaderboard.find((l) => l.player_id === s.player_id);
      map.set(s.challenge_id, row?.username ?? '???');
    }
    return map;
  }, [solves, leaderboard]);

  return {
    challenges,
    days,
    solves,
    leaderboard,
    event,
    loading,
    announcements,
    mySolvedIds,
    myPoints,
    firstBloodByChallenge,
    refreshBoard,
    refreshEvent,
  };
}
