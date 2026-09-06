import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Momentum Fitness",
    short_name: "Momentum",
    description: "Track your lifts, body weight, and progress over time.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f2eb",
    theme_color: "#1b1e1a",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
