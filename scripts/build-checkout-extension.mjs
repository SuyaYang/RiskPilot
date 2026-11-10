import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const out = `${root}extension/dist`;
await mkdir(out, { recursive: true });
await build({
  entryPoints: [`${root}extension/src/content.ts`],
  outfile: `${out}/content.js`, bundle: true, platform: "browser", target: "chrome120", format: "iife",
  define: { "process.env.DEMO_TODAY": "undefined" },
  legalComments: "none",
});
await copyFile(`${root}extension/manifest.json`, `${out}/manifest.json`);
console.log(`Sandbox extension ready: ${out}`);
