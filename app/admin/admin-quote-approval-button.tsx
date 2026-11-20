"use client";

import { useState } from "react";

export default function AdminQuoteApprovalButton({ quoteId }: { quoteId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function approve() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/quotes/approve", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error === "pending_quote_not_found"
          ? "This quote is no longer pending."
          : "Approval failed. Please try again.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={approve}
        disabled={busy}
        style={{
          border: 0,
          borderRadius: 9,
          padding: "10px 14px",
          background: busy ? "#53657c" : "#2fb5ae",
          color: "#071b31",
          fontWeight: 700,
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy ? "Approving…" : "Approve quotation"}
      </button>
      {error ? <p role="alert" style={{ color: "#ffb6a9", fontSize: 12 }}>{error}</p> : null}
    </div>
  );
}
