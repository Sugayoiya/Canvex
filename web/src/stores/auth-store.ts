import { create } from "zustand";
import { persist } from "zustand/middleware";

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
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },
      setTeams: (teams) => set({ teams }),
      switchSpace: (space) => set({ currentSpace: space }),
      logout: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
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
