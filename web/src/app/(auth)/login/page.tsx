"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { useAuthStore, useAuthHydrated } from "@/stores/auth-store";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--ob-surface-high)",
  border: "1px solid var(--ob-glass-border)",
  borderRadius: 6,
  padding: "10px 14px",
  color: "var(--ob-text-primary)",
  fontSize: 13,
  fontFamily: "var(--font-body)",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 200ms",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-headline)",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.2em",
  color: "var(--ob-text-secondary)",
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, isAuthenticated } = useAuthStore();
  const hydrated = useAuthHydrated();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace("/projects");
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");
    if (accessToken && refreshToken) {
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      window.history.replaceState({}, "", "/login");
      authApi
        .me()
        .then((res) => {
          setAuth(res.data, accessToken, refreshToken);
          router.replace("/projects");
        })
        .catch(() => {
          router.replace("/login");
        });
    }
  }, [searchParams, setAuth, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data: tokens } = await authApi.login({ email, password });
      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);
      const { data: user } = await authApi.me();
      setAuth(user, tokens.access_token, tokens.refresh_token);
      router.push("/projects");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Login failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    try {
      const api = provider === "google" ? authApi.googleLogin : authApi.githubLogin;
      const { data } = await api();
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch {
      setError(`Failed to initiate ${provider} login`);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 440, padding: "0 16px" }}>
      {/* Card */}
      <div
        style={{
          background: "var(--ob-glass-bg)",
          border: "1px solid var(--ob-glass-border)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: 16,
          padding: 40,
          boxShadow: "var(--ob-glow-card)",
          transition: "border-color 300ms",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "var(--ob-surface-high)",
              border: "1px solid var(--ob-glass-border)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ob-text-primary)" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M2 12h4M18 12h4M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 24,
              fontWeight: 700,
              color: "var(--ob-text-primary)",
              margin: 0,
            }}
          >
            Obsidian Lens
          </h1>
          <p
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "var(--ob-text-muted)",
              margin: "8px 0 0",
            }}
          >
            Cinematic Production Suite
          </p>
        </div>

        {/* OAuth buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => handleOAuth("google")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: 12,
              background: "var(--ob-surface-high)",
              border: "1px solid var(--ob-glass-border)",
              borderRadius: 8,
              color: "var(--ob-text-primary)",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              cursor: "pointer",
              transition: "border-color 200ms, background 200ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--ob-glass-hover-border)";
              e.currentTarget.style.background = "var(--ob-glass-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--ob-glass-border)";
              e.currentTarget.style.background = "var(--ob-surface-high)";
            }}
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuth("github")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: 12,
              background: "var(--ob-surface-high)",
              border: "1px solid var(--ob-glass-border)",
              borderRadius: 8,
              color: "var(--ob-text-primary)",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              cursor: "pointer",
              transition: "border-color 200ms, background 200ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--ob-glass-hover-border)";
              e.currentTarget.style.background = "var(--ob-glass-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--ob-glass-border)";
              e.currentTarget.style.background = "var(--ob-surface-high)";
            }}
          >
            <GitHubIcon />
            Continue with GitHub
          </button>
        </div>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ flex: 1, height: 1, background: "var(--ob-glass-border)" }} />
          <span
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "var(--ob-text-muted)",
              whiteSpace: "nowrap",
            }}
          >
            Or Email
          </span>
          <div style={{ flex: 1, height: 1, background: "var(--ob-glass-border)" }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(255,180,171,0.1)",
                border: "1px solid rgba(255,180,171,0.2)",
                color: "var(--ob-error)",
                fontSize: 13,
                fontFamily: "var(--font-body)",
              }}
            >
              {error}
            </div>
          )}

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <label style={labelStyle}>Email Address</label>
              <button type="button" style={{ background: "none", border: "none", padding: 0, ...labelStyle, color: "var(--ob-text-muted)", cursor: "pointer", textDecoration: "none" }}>
                Forgot?
              </button>
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ob-primary)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ob-glass-border)"; }}
            />
          </div>

          <div>
            <label style={{ ...labelStyle, display: "block", marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ob-primary)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ob-glass-border)"; }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 12,
              background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(200,200,200,0.8) 100%)",
              color: "#000",
              fontFamily: "var(--font-headline)",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              borderRadius: 6,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              transition: "transform 100ms, opacity 200ms",
            }}
            onMouseDown={(e) => { if (!loading) e.currentTarget.style.transform = "scale(0.98)"; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            {loading ? "Signing in..." : "Access Studio"}
          </button>
        </form>

        {/* Bottom link */}
        <p
          style={{
            textAlign: "center",
            marginTop: 24,
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--ob-text-muted)",
          }}
        >
          New to Obsidian?{" "}
          <Link
            href="/register"
            style={{
              color: "var(--ob-text-secondary)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Request early access
          </Link>
        </p>
      </div>

      {/* Footer badge */}
      <p
        style={{
          textAlign: "center",
          marginTop: 20,
          fontFamily: "var(--font-headline)",
          fontSize: 9,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          color: "var(--ob-text-muted)",
        }}
      >
        🛡️ Protected by AuthGuard v2.4
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
