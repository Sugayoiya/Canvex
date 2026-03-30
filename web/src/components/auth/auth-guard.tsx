"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore, useAuthHydrated } from "@/stores/auth-store";

const PUBLIC_PATHS = ["/login", "/register", "/invite"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const hydrated = useAuthHydrated();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (hydrated && !isAuthenticated && !PUBLIC_PATHS.some(p => pathname?.startsWith(p))) {
      router.replace("/login");
    }
  }, [hydrated, isAuthenticated, pathname, router]);

  if (!hydrated) return null;
  if (!isAuthenticated && !PUBLIC_PATHS.some(p => pathname?.startsWith(p))) return null;

  return <>{children}</>;
}
