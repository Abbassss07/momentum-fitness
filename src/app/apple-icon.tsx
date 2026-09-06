import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ background: "#1b1e1a", color: "#c7d4a9", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 110, fontWeight: 800, fontFamily: "Arial, sans-serif", letterSpacing: "-11px", paddingRight: 11 }}>
      M
    </div>,
    size,
  );
}
