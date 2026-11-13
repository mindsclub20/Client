import type { ReactNode } from "react";
import NetworkBackground from "./network-background";

/**
 * Visual shell for /admin and /client only.
 * Matches homepage/login palette (#0a2147) and constellation network.
 * Does not modify homepage or #login markup.
 */
export default function DashboardShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#0a2147",
        color: "#eaf1fb",
        fontFamily: "Manrope, system-ui, sans-serif",
      }}
    >
      <NetworkBackground />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}
