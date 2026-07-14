import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

import { build } from "esbuild";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveNextAlias(importPath) {
  const basePath = path.join(projectRoot, importPath.slice(2));
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? basePath;
}

async function loadRenderer() {
  const outDir = await mkdtemp(path.join(tmpdir(), "template-v2-html-test-"));
  const outfile = path.join(outDir, "renderer.mjs");

  await build({
    entryPoints: [path.join(projectRoot, "lib", "template-v2-json-to-html.ts")],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    sourcemap: false,
    logLevel: "silent",
    plugins: [
      {
        name: "next-alias",
        setup(builder) {
          builder.onResolve({ filter: /^@\// }, (args) => ({
            path: resolveNextAlias(args.path),
          }));
        },
      },
    ],
  });

  return import(pathToFileURL(outfile).href);
}

const rendererPromise = loadRenderer();

test("renders text shadows and explicit false run font overrides", async () => {
  const { templateV2UiToHtml } = await rendererPromise;
  const html = templateV2UiToHtml({
    elements: [
      {
        type: "text",
        position: { x: 12, y: 16 },
        size: { width: 360, height: 96 },
        text: "Headline",
        runs: [{ text: "Headline", font: { bold: false, italic: false } }],
        font: {
          family: "Arial",
          size: 28,
          color: "#111111",
          bold: true,
          italic: true,
          line_height: 1.2,
        },
        shadow: {
          color: "#123456",
          opacity: 0.5,
          offsetX: 2,
          offsetY: 3,
          blur: 4,
        },
      },
    ],
  });

  assert.ok(html);
  assert.match(html, /text-shadow:2px 3px 4px rgba\(18,52,86,0\.5\);/);
  assert.match(html, /font-style:normal;/);
  assert.match(html, /font-weight:400;/);
});

test("uses the default text line-height when none is provided", async () => {
  const { templateV2UiToHtml } = await rendererPromise;
  const html = templateV2UiToHtml({
    elements: [
      {
        type: "text",
        position: { x: 0, y: 0 },
        size: { width: 320, height: 80 },
        text: "Default line height",
        font: { family: "Arial", size: 20, color: "#111111" },
      },
    ],
  });

  assert.ok(html);
  assert.match(html, /line-height:1\.1;/);
});

test("renders zero-height horizontal lines with a stroke-sized frame", async () => {
  const { templateV2UiToHtml } = await rendererPromise;
  const html = templateV2UiToHtml({
    components: [
      {
        position: { x: 0, y: 0 },
        size: { width: 689, height: 24 },
        elements: [
          {
            type: "line",
            position: { x: 0, y: 19.63 },
            size: { width: 689, height: 0 },
            stroke: { color: "#FFFFFF", width: 2.67 },
          },
        ],
      },
    ],
  });

  assert.ok(html);
  assert.match(html, /height:2\.67px;/);
  assert.match(html, /viewBox="0 0 689 2\.67"/);
  assert.match(html, /stroke-width="2\.67"/);
});

test("normalizes camelCase chart kinds before rendering chart config", async () => {
  const { templateV2UiToHtml } = await rendererPromise;
  const html = templateV2UiToHtml({
    elements: [
      {
        type: "chart",
        chartType: "horizontalStackedBar",
        position: { x: 0, y: 0 },
        size: { width: 420, height: 260 },
        categories: ["A", "B"],
        series: [
          { name: "North", values: [4, 6] },
          { name: "South", values: [2, 8] },
        ],
      },
    ],
  });

  assert.ok(html);
  assert.match(html, /&quot;type&quot;:&quot;bar&quot;/);
  assert.match(html, /&quot;indexAxis&quot;:&quot;y&quot;/);
  assert.match(html, /&quot;stacked&quot;:true/);
});
