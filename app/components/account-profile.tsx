"use client";

function initials(name: string | null, email: string): string {
  const source = (name || email || "U").trim();
  const parts = source.includes("@") ? [source.split("@")[0]] : source.split(/\s+/);
  const value = parts.slice(0, 2).map((part) => part.charAt(0)).join("");
  return value.toUpperCase() || "U";
}

export default function AccountProfile({
  email,
  name,
}: {
  email: string;
  name: string | null;
}) {
  return (
    <aside
      aria-label="Signed-in account"
      style={{
        position: "fixed",
        left: 18,
        bottom: 18,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 11,
        width: "min(290px, calc(100vw - 36px))",
        boxSizing: "border-box",
        padding: "10px 13px",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 14,
        background: "rgba(7, 24, 53, 0.94)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <div
        role="img"
        aria-label="Default profile picture"
        style={{
          width: 38,
          height: 38,
          flex: "0 0 38px",
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.24)",
          background: "linear-gradient(135deg, #2fb5ae, #1b4a86)",
          color: "#ffffff",
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 0.4,
        }}
      >
        {initials(name, email)}
      </div>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ color: "#eaf1fb", fontSize: 12, fontWeight: 700 }}>
          {name || "MAXWEB account"}
        </span>
        <span
          title={email}
          style={{
            color: "#9fb3cf",
            fontSize: 11,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {email}
        </span>
      </div>
    </aside>
  );
}
