import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const temporaryDirectory = mkdtempSync(
  join(tmpdir(), "dialnexa-agent-template-export-"),
);
const bundledExporter = join(temporaryDirectory, "export.mjs");

try {
  await build({
    entryPoints: [resolve("scripts/export-agent-templates.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundledExporter,
  });
  await import(pathToFileURL(bundledExporter).href);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
