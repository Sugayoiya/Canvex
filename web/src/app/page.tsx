"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useAuthHydrated } from "@/stores/auth-store";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const hydrated = useAuthHydrated();

  useEffect(() => {
    if (!hydrated) return;
    if (isAuthenticated) {
      router.replace("/projects");
    } else {
      router.replace("/login");
    }
  }, [hydrated, isAuthenticated, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg text-gray-500">
        Canvex 加载中...
      </div>
    </div>
  );
}
