"use client";

import { useState } from "react";

export default function AdminLogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("Sign-out request failed");
      window.location.replace("/#login");
    } catch {
      setBusy(false);
      setError("Could not log out. Please try again.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        style={{
          border: "1px solid #52658e",
          borderRadius: 8,
          padding: "10px 16px",
          color: "#eef2ff",
          background: busy ? "#26334d" : "#17243d",
          cursor: busy ? "wait" : "pointer",
          fontWeight: 600,
        }}
      >
        {busy ? "Logging out…" : "Log out"}
      </button>
      {error ? <span role="alert" style={{ color: "#ff9b9b", fontSize: 12 }}>{error}</span> : null}
    </div>
  );
}
