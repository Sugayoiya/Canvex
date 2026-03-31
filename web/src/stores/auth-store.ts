import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  nickname: string;
  avatar?: string;
  is_admin: boolean;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  my_role: string;
}

type SpaceContext =
  | { type: "personal" }
  | { type: "team"; teamId: string; teamName: string };

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  teams: Team[];
  currentSpace: SpaceContext;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setTeams: (teams: Team[]) => void;
  switchSpace: (space: SpaceContext) => void;
  logout: () => void;
}

export type { User, Team, SpaceContext };

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      teams: [],
      currentSpace: { type: "personal" } as SpaceContext,
      setAuth: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },
      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
      },
      setTeams: (teams) => set({ teams }),
      switchSpace: (space) => set({ currentSpace: space }),
      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          teams: [],
          currentSpace: { type: "personal" },
        });
      },
    }),
    { name: "canvas-studio-auth" }
  )
);

/** Read access token from the single source of truth (Zustand persist). */
export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

/** Read refresh token from the single source of truth (Zustand persist). */
export function getRefreshToken(): string | null {
  return useAuthStore.getState().refreshToken;
}

export function useAuthHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}
