import { supabase } from './supabase';
import type {
  AdminOverview,
  Challenge,
  Day,
  EventConfig,
  HintResult,
  LeaderboardRow,
  Player,
  Solve,
  SubmitResult,
} from './types';

export async function registerPlayer(username: string): Promise<Player> {
  const { data, error } = await supabase.rpc('register_player', { p_username: username });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.message ?? 'Registration failed.');
  return { id: data.player_id, token: data.token, username: data.username };
}

export async function submitFlag(
  player: Player,
  challengeId: string,
  flag: string,
): Promise<SubmitResult> {
  const { data, error } = await supabase.rpc('submit_flag', {
    p_player_id: player.id,
    p_token: player.token,
    p_challenge_id: challengeId,
    p_flag: flag,
  });
  if (error) throw new Error(error.message);
  return data as SubmitResult;
}

export async function unlockHint(
  player: Player,
  challengeId: string,
  hintNumber: number,
): Promise<HintResult> {
  const { data, error } = await supabase.rpc('unlock_hint', {
    p_player_id: player.id,
    p_token: player.token,
    p_challenge_id: challengeId,
    p_hint_number: hintNumber,
  });
  if (error) throw new Error(error.message);
  return data as HintResult;
}

export async function fetchChallenges(): Promise<Challenge[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Challenge[];
}

export async function fetchDays(): Promise<Day[]> {
  const { data, error } = await supabase
    .from('days')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Day[];
}

export async function fetchSolves(): Promise<Solve[]> {
  const { data, error } = await supabase
    .from('solves')
    .select('*')
    .order('solved_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Solve[];
}

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.from('leaderboard').select('*');
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as LeaderboardRow[];
  // Rank: most points first, then whoever reached their score earliest.
  rows.sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    const ta = a.last_solve_at ? Date.parse(a.last_solve_at) : Infinity;
    const tb = b.last_solve_at ? Date.parse(b.last_solve_at) : Infinity;
    return ta - tb;
  });
  return rows;
}

export async function fetchEventConfig(): Promise<EventConfig> {
  const { data, error } = await supabase
    .from('event_config')
    .select('name, starts_at, ends_at, duration_minutes, freeze_minutes')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? {
    name: 'KGSP CTF',
    starts_at: null,
    ends_at: null,
    duration_minutes: 60,
    freeze_minutes: 15,
  }) as EventConfig;
}

// --- admin ---
export async function adminStartEvent(secret: string, minutes: number) {
  const { data, error } = await supabase.rpc('admin_start_event', {
    p_secret: secret,
    p_minutes: minutes,
  });
  if (error) throw new Error(error.message);
  return data as { error?: string; message?: string; ends_at?: string };
}

export async function adminStopEvent(secret: string) {
  const { data, error } = await supabase.rpc('admin_stop_event', { p_secret: secret });
  if (error) throw new Error(error.message);
  return data as { error?: string; message?: string };
}

export async function adminReset(secret: string) {
  const { data, error } = await supabase.rpc('admin_reset', { p_secret: secret });
  if (error) throw new Error(error.message);
  return data as { error?: string; message?: string };
}

export async function adminOverview(secret: string): Promise<AdminOverview> {
  const { data, error } = await supabase.rpc('admin_overview', { p_secret: secret });
  if (error) throw new Error(error.message);
  return data as AdminOverview;
}

export async function adminSetDay(secret: string, day: number, isOpen: boolean) {
  const { data, error } = await supabase.rpc('admin_set_day', {
    p_secret: secret,
    p_day: day,
    p_is_open: isOpen,
  });
  if (error) throw new Error(error.message);
  return data as { error?: string; message?: string; ok?: boolean };
}

export async function adminSetFreeze(secret: string, minutes: number) {
  const { data, error } = await supabase.rpc('admin_set_freeze', {
    p_secret: secret,
    p_minutes: minutes,
  });
  if (error) throw new Error(error.message);
  return data as { error?: string; message?: string; freeze_minutes?: number };
}
