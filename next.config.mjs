import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig['distDir']} */
const developmentOutput = ".next-dev";

/** @type {import('next').NextConfig | ((phase: string) => import('next').NextConfig)} */
export default function nextConfig(phase) {
  return {
    reactStrictMode: true,
    // A production build must never overwrite a running development server's chunks.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? developmentOutput : ".next",
  };
}
