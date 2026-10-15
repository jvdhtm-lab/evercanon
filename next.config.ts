import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal, self-contained server bundle for the production Docker image.
  output: "standalone",
};

export default nextConfig;
