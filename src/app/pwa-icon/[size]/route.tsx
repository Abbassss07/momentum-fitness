import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: requestedSize } = await params;
  const dimension = requestedSize === "192" ? 192 : 512;
  const fontSize = dimension === 192 ? 118 : 310;
  const letterSpacing = dimension === 192 ? "-12px" : "-30px";
  const paddingRight = dimension === 192 ? 12 : 30;

  return new ImageResponse(
    <div style={{ background: "#1b1e1a", color: "#c7d4a9", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize, fontWeight: 800, fontFamily: "Arial, sans-serif", letterSpacing, paddingRight }}>
      M
    </div>,
    { width: dimension, height: dimension },
  );
}
