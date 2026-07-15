export type Difficulty = 'easy' | 'medium' | 'hard' | 'danger';

export interface Challenge {
  id: string;
  title: string;
  category: string;
  difficulty: Difficulty;
  /** Starting/base value before solve-order decay. */
  points: number;
  first_blood_bonus: number;
  /** Points removed for each solver after the second. Zero keeps static scoring. */
  score_decay_step: number;
  /** Lowest base value reachable through solve-order decay. */
  score_minimum: number;
  sort_order: number;
  prompt: string;
  asset_url: string | null;
  action_url: string | null;
  num_hints: number;
  day: number;
  is_extra: boolean;
  suggested_tool: string | null;
}

export interface Day {
  day: number;
  title: string;
  subtitle: string | null;
  is_open: boolean;
  event_label: string | null;
  sort_order: number;
  is_rest: boolean;
  requires_code: boolean;
  /** Admin-marked "done" — always readable for practice, never fairness-blurred. */
  is_completed: boolean;
}

export interface Player {
  id: string;
  username: string;
  token: string;
  avatar: string;
  is_admin: boolean;
  /** Admin session token (the admin_config secret) — only present when is_admin is true. */
  admin_token?: string | null;
}

export interface Solve {
  id: string;
  player_id: string;
  challenge_id: string;
  points_awarded: number;
  is_first_blood: boolean;
  solved_at: string;
}

export interface LeaderboardRow {
  player_id: string;
  username: string;
  avatar: string;
  total_points: number;
  solves_count: number;
  last_solve_at: string | null;
}

export interface EventConfig {
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  duration_minutes: number;
  freeze_minutes: number;
  /** Which day's leaderboard is currently "live" for students. */
  active_day: number | null;
  /**
   * Drives the synced winner reveal. The instructor advances it and every screen
   * in the room follows, because event_config is already in the realtime feed.
   *   -1 closed · 0 cards face down · 1 third · 2 second · 3 first
   */
  finale_stage: number;
}

export interface SubmitResult {
  correct?: boolean;
  first_blood?: boolean;
  already_solved?: boolean;
  /** True when an admin/excluded account submitted: verified but deliberately not scored. */
  test_mode?: boolean;
  points_awarded?: number;
  total_points?: number;
  message?: string;
  error?: string;
}

export interface HintResult {
  body?: string;
  penalty?: number;
  already_unlocked?: boolean;
  message?: string;
  error?: string;
}

// ---- Admin overview (secret-gated) ----
export interface AdminChallenge {
  id: string;
  title: string;
  day: number;
  category: string;
  difficulty: Difficulty;
  points: number;
  first_blood_bonus: number;
  score_decay_step: number;
  score_minimum: number;
  sort_order: number;
  num_hints: number;
  prompt: string;
  asset_url: string | null;
  action_url: string | null;
  is_extra: boolean;
  suggested_tool: string | null;
  flag: string;
  solves_count: number;
  first_blood_by: string | null;
  hints: { n: number; body: string; penalty: number }[];
}

export interface AdminDay extends Day {
  code?: string | null;
}

export interface AdminOverview {
  ok?: boolean;
  error?: string;
  message?: string;
  event?: EventConfig;
  players_count?: number;
  total_solves?: number;
  days?: AdminDay[];
  challenges?: AdminChallenge[];
}

// ---- Admin auth + player management ----
export interface AdminLoginResult {
  ok?: boolean;
  error?: string;
  message?: string;
  token?: string;
  username?: string;
}

export interface AdminPlayerSolve {
  challenge_id: string;
  points: number;
  first_blood: boolean;
  solved_at: string;
}

export interface AdminPlayer {
  id: string;
  username: string;
  avatar: string;
  created_at: string;
  total_points: number;
  solves_count: number;
  first_bloods: number;
  /** When true, the player is hidden from the leaderboard/board/feed (test account). */
  exclude_from_board?: boolean;
  solves: AdminPlayerSolve[];
}

export interface AdminPlayersResult {
  ok?: boolean;
  error?: string;
  message?: string;
  players?: AdminPlayer[];
}
