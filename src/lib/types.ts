export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Challenge {
  id: string;
  title: string;
  category: string;
  difficulty: Difficulty;
  points: number;
  first_blood_bonus: number;
  sort_order: number;
  prompt: string;
  asset_url: string | null;
  action_url: string | null;
  num_hints: number;
  day: number;
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
}

export interface Player {
  id: string;
  username: string;
  token: string;
  avatar: string;
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
}

export interface SubmitResult {
  correct?: boolean;
  first_blood?: boolean;
  already_solved?: boolean;
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
  sort_order: number;
  num_hints: number;
  prompt: string;
  asset_url: string | null;
  action_url: string | null;
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
