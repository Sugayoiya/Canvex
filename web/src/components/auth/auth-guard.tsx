"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

const PUBLIC_PATHS = ["/login", "/register", "/invite"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !isAuthenticated && !PUBLIC_PATHS.some(p => pathname?.startsWith(p))) {
      router.replace("/login");
    }
  }, [mounted, isAuthenticated, pathname, router]);

  if (!mounted) return null;
  if (!isAuthenticated && !PUBLIC_PATHS.some(p => pathname?.startsWith(p))) return null;

  return <>{children}</>;
}
