import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const electron = path.join(root, "electron");

await esbuild.build({
  entryPoints: [path.join(electron, "main.ts"), path.join(electron, "preload.ts")],
  outdir: electron,
  outExtension: { ".js": ".cjs" },
  platform: "node",
  format: "cjs",
  bundle: true,
  packages: "external",
  external: ["electron"],
  logLevel: "info",
});

console.log("electron build done");
