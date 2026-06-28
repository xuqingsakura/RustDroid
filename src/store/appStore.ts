import { create } from 'zustand';

export type Theme = 'dark' | 'light';

interface AppState {
  version: string;
  theme: Theme;
  setVersion: (v: string) => void;
  setTheme: (t: Theme) => void;
}

export const useAppStore = create<AppState>((set) => ({
  version: '0.0.0',
  theme: 'dark',
  setVersion: (v) => set({ version: v }),
  setTheme: (t) => set({ theme: t }),
}));
