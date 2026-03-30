"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { teamsApi } from "@/lib/api";

type InviteStatus = "loading" | "success" | "error" | "unauthenticated";

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [status, setStatus] = useState<InviteStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setStatus("unauthenticated");
      return;
    }

    teamsApi
      .acceptInvitation(token)
      .then((res) => {
        setStatus("success");
        const tid = res.data?.team_id || res.data?.team?.id;
        if (tid) setTeamId(tid);
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(
          err.response?.data?.detail || "Failed to accept invitation.",
        );
      });
  }, [token, isAuthenticated]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--ob-surface-base)",
        backgroundImage: "var(--ob-dot-grid)",
        backgroundSize: "var(--ob-dot-grid-size)",
      }}
    >
      <div
        style={{
          background: "var(--ob-glass-bg)",
          border: "1px solid var(--ob-glass-border)",
          backdropFilter: "blur(16px)",
          borderRadius: 16,
          padding: "40px 36px",
          width: 420,
          maxWidth: "90vw",
          textAlign: "center",
        }}
      >
        {status === "loading" && (
          <>
            <div
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: 20,
                fontWeight: 700,
                color: "var(--ob-text-primary)",
                marginBottom: 12,
              }}
            >
              Accepting Invitation...
            </div>
            <p
              style={{
                fontSize: 13,
                color: "var(--ob-text-muted)",
              }}
            >
              Please wait while we process your invitation.
            </p>
          </>
        )}

        {status === "unauthenticated" && (
          <>
            <div
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: 20,
                fontWeight: 700,
                color: "var(--ob-text-primary)",
                marginBottom: 12,
              }}
            >
              You&apos;ve Been Invited
            </div>
            <p
              style={{
                fontSize: 13,
                color: "var(--ob-text-muted)",
                marginBottom: 24,
              }}
            >
              Log in or create an account to accept this team invitation.
            </p>
            <button
              type="button"
              onClick={() =>
                router.push(`/login?redirect=/invite/${token}`)
              }
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: "var(--ob-gradient-primary)",
                color: "var(--ob-text-on-primary)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Login to Accept
            </button>
          </>
        )}

        {status === "success" && (
          <>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "rgba(76, 175, 80, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <span style={{ fontSize: 24 }}>✓</span>
            </div>
            <div
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: 20,
                fontWeight: 700,
                color: "var(--ob-text-primary)",
                marginBottom: 12,
              }}
            >
              Welcome to the Team!
            </div>
            <p
              style={{
                fontSize: 13,
                color: "var(--ob-text-muted)",
                marginBottom: 24,
              }}
            >
              Your invitation has been accepted successfully.
            </p>
            <button
              type="button"
              onClick={() =>
                router.push(teamId ? `/teams/${teamId}` : "/teams")
              }
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: "var(--ob-gradient-primary)",
                color: "var(--ob-text-on-primary)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Go to Team
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "rgba(255, 180, 171, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <span style={{ fontSize: 24, color: "var(--ob-error)" }}>✕</span>
            </div>
            <div
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: 20,
                fontWeight: 700,
                color: "var(--ob-text-primary)",
                marginBottom: 12,
              }}
            >
              Invitation Failed
            </div>
            <p
              style={{
                fontSize: 13,
                color: "var(--ob-text-muted)",
                marginBottom: 24,
              }}
            >
              {errorMsg}
            </p>
            <button
              type="button"
              onClick={() => router.push("/teams")}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "1px solid var(--ob-glass-border)",
                background: "transparent",
                color: "var(--ob-text-primary)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Go to Teams
            </button>
          </>
        )}
      </div>
    </div>
  );
}
