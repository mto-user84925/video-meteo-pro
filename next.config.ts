import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Suppression systématique du cache : aucun composant ou page en cache
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0" },
        { key: "Pragma", value: "no-cache" },
        { key: "Expires", value: "0" },
        { key: "Surrogate-Control", value: "no-store" },
      ],
    },
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
