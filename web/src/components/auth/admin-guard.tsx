"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useAuthHydrated } from "@/stores/auth-store";
import { authApi } from "@/lib/api";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, setAuth } = useAuthStore();
  const hydrated = useAuthHydrated();
  const router = useRouter();
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    authApi
      .me()
      .then(({ data: freshUser }) => {
        const { accessToken, refreshToken } = useAuthStore.getState();
        if (accessToken && refreshToken) {
          setAuth(freshUser, accessToken, refreshToken);
        }
        if (!freshUser.is_admin) {
          router.replace("/projects");
        } else {
          setVerified(true);
        }
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [hydrated, isAuthenticated, router, setAuth]);

  if (!hydrated || !verified) return null;
  if (!user?.is_admin) return null;

  return <>{children}</>;
}
