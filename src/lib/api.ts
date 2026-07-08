import { supabase } from './supabase';
import type {
  AdminLoginResult,
  AdminOverview,
  AdminPlayersResult,
  Challenge,
  Day,
  EventConfig,
  HintResult,
  LeaderboardRow,
  Player,
  Solve,
  SubmitResult,
} from './types';

export async function registerPlayer(username: string, password: string, avatar: string): Promise<Player> {
  const { data, error } = await supabase.rpc('register_player', {
    p_username: username,
    p_password: password,
    p_avatar: avatar,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.message ?? 'Registration failed.');
  return {
    id: data.player_id,
    token: data.token,
    username: data.username,
    avatar: data.avatar,
    is_admin: false,
    admin_token: null,
  };
}

export async function loginPlayer(username: string, password: string): Promise<Player> {
  const { data, error } = await supabase.rpc('login_player', {
    p_username: username,
    p_password: password,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.message ?? 'Login failed.');
  return {
    id: data.player_id,
    token: data.token,
    username: data.username,
    avatar: data.avatar,
    is_admin: !!data.is_admin,
    admin_token: data.admin_token ?? null,
  };
}

export async function checkDayCode(player: Player, day: number, code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_day_code', {
    p_player_id: player.id,
    p_token: player.token,
    p_day: day,
    p_code: code,
  });
  if (error) throw new Error(error.message);
  return data?.ok === true;
}

/**
 * Returns true if the player row still exists in the database. Used to log out
 * players whose account was deleted by an admin. On a network error we return
 * true so we never sign someone out just because a request failed.
 */
export async function playerStillExists(id: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (error) return true;
    return !!data;
  } catch {
    return true;
  }
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
  return sortLeaderboard((data ?? []) as LeaderboardRow[]);
}

/** The leaderboard scoped to a single day (used for the "live" board so it resets per day). */
export async function fetchDayLeaderboard(day: number): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc('day_leaderboard', { p_day: day });
  if (error) throw new Error(error.message);
  return sortLeaderboard((data ?? []) as LeaderboardRow[]);
}

/**
 * Rank: most points first, then whoever reached their score earliest, and
 * finally a stable tiebreak on player_id so equally-scored rows keep a fixed
 * order across refetches (otherwise tied rows visibly reshuffle every update).
 */
function sortLeaderboard(rows: LeaderboardRow[]): LeaderboardRow[] {
  rows.sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    const ta = a.last_solve_at ? Date.parse(a.last_solve_at) : Infinity;
    const tb = b.last_solve_at ? Date.parse(b.last_solve_at) : Infinity;
    if (ta !== tb) return ta - tb;
    return a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : 0;
  });
  return rows;
}

export async function fetchEventConfig(): Promise<EventConfig> {
  const { data, error } = await supabase
    .from('event_config')
    .select('name, starts_at, ends_at, duration_minutes, freeze_minutes, active_day')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? {
    name: 'KGSP CTF',
    starts_at: null,
    ends_at: null,
    duration_minutes: 35,
    freeze_minutes: 15,
    active_day: null,
  }) as EventConfig;
}

// --- dynamic (per-player) challenges ---
// The flag is never in the client bundle or the database as a fixed string:
// verify_challenge_answer checks the recovered "answer" server-side and, only
// if correct, mints a personal flag via HMAC(player_id) that validates ONLY
// for that player. challenge_live_material returns material (e.g. a decode
// key) that is deliberately withheld from the downloadable artifact.
export interface VerifyAnswerResult {
  ok?: boolean;
  message?: string;
  flag?: string;
}

export async function verifyChallengeAnswer(
  player: Player,
  challengeId: string,
  answer: string,
): Promise<VerifyAnswerResult> {
  const { data, error } = await supabase.rpc('verify_challenge_answer', {
    p_player_id: player.id,
    p_token: player.token,
    p_challenge_id: challengeId,
    p_answer: answer,
  });
  if (error) throw new Error(error.message);
  return data as VerifyAnswerResult;
}

export interface LiveMaterialResult {
  ok?: boolean;
  error?: string;
  message?: string;
  material?: Record<string, string>;
}

export async function fetchChallengeLiveMaterial(
  player: Player,
  challengeId: string,
): Promise<LiveMaterialResult> {
  const { data, error } = await supabase.rpc('challenge_live_material', {
    p_player_id: player.id,
    p_token: player.token,
    p_challenge_id: challengeId,
  });
  if (error) throw new Error(error.message);
  return data as LiveMaterialResult;
}

// --- admin ---
export async function adminLogin(username: string, password: string): Promise<AdminLoginResult> {
  const { data, error } = await supabase.rpc('admin_login', {
    p_username: username,
    p_password: password,
  });
  if (error) throw new Error(error.message);
  return data as AdminLoginResult;
}

export async function adminListPlayers(secret: string): Promise<AdminPlayersResult> {
  const { data, error } = await supabase.rpc('admin_list_players', { p_secret: secret });
  if (error) throw new Error(error.message);
  return data as AdminPlayersResult;
}

export async function adminDeletePlayer(secret: string, playerId: string) {
  const { data, error } = await supabase.rpc('admin_delete_player', {
    p_secret: secret,
    p_player_id: playerId,
  });
  if (error) throw new Error(error.message);
  return data as { error?: string; message?: string; ok?: boolean; deleted?: number };
}

export async function adminDeleteAllPlayers(secret: string) {
  const { data, error } = await supabase.rpc('admin_delete_all_players', { p_secret: secret });
  if (error) throw new Error(error.message);
  return data as { error?: string; message?: string; ok?: boolean; deleted?: number };
}

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

/**
 * Resets scores/attempts/hints for ONE day only (and the shared event clock).
 * Scoped by day on purpose — a previous unscoped version wiped every day's
 * history at once when only the active day was meant to be reset.
 */
export async function adminReset(secret: string, day: number) {
  const { data, error } = await supabase.rpc('admin_reset', { p_secret: secret, p_day: day });
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

/**
 * Hide (or unhide) a player from the competition — leaderboard, projector board,
 * live feed, and first-blood — without deleting their account or solves. Used
 * for instructor/test accounts so they can try challenges without polluting the
 * real standings.
 */
export async function adminSetPlayerExcluded(secret: string, playerId: string, excluded: boolean) {
  const { data, error } = await supabase.rpc('admin_set_player_excluded', {
    p_secret: secret,
    p_player_id: playerId,
    p_excluded: excluded,
  });
  if (error) throw new Error(error.message);
  return data as { error?: string; message?: string; ok?: boolean; exclude_from_board?: boolean };
}

export async function adminSetDayCode(secret: string, day: number, code: string) {
  const { data, error } = await supabase.rpc('admin_set_day_code', {
    p_secret: secret,
    p_day: day,
    p_code: code,
  });
  if (error) throw new Error(error.message);
  return data as { error?: string; message?: string; ok?: boolean };
}

/** Switch which day's leaderboard is "live" for students. */
export async function adminSetActiveDay(secret: string, day: number) {
  const { data, error } = await supabase.rpc('admin_set_active_day', {
    p_secret: secret,
    p_day: day,
  });
  if (error) throw new Error(error.message);
  return data as { error?: string; message?: string; ok?: boolean; active_day?: number };
}
