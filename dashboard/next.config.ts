import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  // PGlite (modo dev) carga su WASM desde disco; no debe pasar por el bundler.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
