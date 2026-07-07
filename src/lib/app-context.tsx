import { createContext, useContext } from 'react';
import type { Player } from './types';

export interface AppState {
  player: Player | null;
  setPlayer: (p: Player | null) => void;
  muted: boolean;
  toggleMute: () => void;
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppContext');
  return ctx;
}
