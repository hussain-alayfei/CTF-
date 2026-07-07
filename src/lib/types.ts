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
}

export interface Player {
  id: string;
  username: string;
  token: string;
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
  total_points: number;
  solves_count: number;
  last_solve_at: string | null;
}

export interface EventConfig {
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  duration_minutes: number;
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
