import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ background: "#1b1e1a", color: "#c7d4a9", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 310, fontWeight: 800, fontFamily: "Arial, sans-serif", letterSpacing: "-30px", paddingRight: 30 }}>
      M
    </div>,
    size,
  );
}
