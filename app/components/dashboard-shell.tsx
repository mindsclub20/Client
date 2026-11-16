import type { ReactNode } from "react";
import NetworkBackground from "./network-background";

/**
 * Visual shell for /admin and /client only.
 * Matches homepage/login palette (#0a2147, teal #2fb5ae, gold #d29a68)
 * and constellation network. Does not modify homepage or #login markup.
 */
export default function DashboardShell({
  children,
  topNav,
}: {
  children: ReactNode;
  topNav?: ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#0a2147",
        color: "#eaf1fb",
        fontFamily: "Manrope, system-ui, sans-serif",
        overflowX: "hidden",
      }}
    >
      <NetworkBackground />

      {/* Soft homepage-style radial glow — decorative only */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(47,181,174,0.16), transparent 55%)," +
            "radial-gradient(ellipse 50% 40% at 90% 80%, rgba(210,154,104,0.08), transparent 50%)," +
            "radial-gradient(ellipse 40% 30% at 10% 70%, rgba(27,74,134,0.35), transparent 45%)",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        {topNav ? (
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 20,
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              background: "rgba(10, 33, 71, 0.72)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {topNav}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/** Shared surface styles aligned to homepage cards */
export const dash = {
  card: {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 22,
    background:
      "linear-gradient(165deg, rgba(20,58,114,0.92), rgba(14,45,92,0.88))",
    boxShadow: "0 18px 40px rgba(0,0,0,0.22)",
    backdropFilter: "blur(8px)",
  } as React.CSSProperties,
  cardSoft: {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 18,
    background: "rgba(10, 33, 71, 0.55)",
  } as React.CSSProperties,
  label: {
    color: "#9fb3cf",
    letterSpacing: 2.2,
    fontSize: 11,
    margin: 0,
    textTransform: "uppercase" as const,
    fontWeight: 600,
  } as React.CSSProperties,
  h1: {
    fontFamily: "Instrument Serif, Georgia, serif",
    fontWeight: 400,
    fontSize: "clamp(28px, 4vw, 36px)",
    margin: "10px 0 0",
    letterSpacing: "-0.02em",
    lineHeight: 1.15,
  } as React.CSSProperties,
  muted: {
    color: "#9fb3cf",
    fontSize: 14,
    lineHeight: 1.55,
  } as React.CSSProperties,
  accentBtn: {
    border: "none",
    borderRadius: 12,
    padding: "12px 18px",
    background: "linear-gradient(135deg, #2fb5ae, #1f9a94)",
    color: "#0a2147",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
    boxShadow: "0 8px 20px rgba(47,181,174,0.25)",
  } as React.CSSProperties,
  ghostBtn: {
    border: "1px solid rgba(255,255,255,0.28)",
    borderRadius: 12,
    padding: "11px 16px",
    background: "rgba(255,255,255,0.04)",
    color: "#eaf1fb",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  } as React.CSSProperties,
  chip: {
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 999,
    padding: "8px 14px",
    background: "rgba(10, 33, 71, 0.65)",
    color: "#eaf1fb",
    fontSize: 12,
    cursor: "pointer",
    transition: "border-color 0.15s ease, background 0.15s ease",
  } as React.CSSProperties,
  gold: "#d29a68",
  teal: "#2fb5ae",
  text: "#eaf1fb",
  mutedColor: "#9fb3cf",
};
