import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig['distDir']} */
const developmentOutput = ".next-dev";
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig | ((phase: string) => import('next').NextConfig)} */
export default function nextConfig(phase) {
  return {
    reactStrictMode: true,
    // A production build must never overwrite a running development server's chunks.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? developmentOutput : ".next",
    outputFileTracingRoot: projectRoot,
  };
}
