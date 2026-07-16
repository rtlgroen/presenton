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

test("renders zero-height horizontal vector lines with a stroke-sized frame", async () => {
  const { templateV2UiToHtml } = await rendererPromise;
  const html = templateV2UiToHtml({
    components: [
      {
        position: { x: 0, y: 0 },
        elements: [
          {
            type: "vector",
            points: [
              { x: 0, y: 19.63 },
              { x: 689, y: 19.63 },
            ],
            closed: false,
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

test("renders signed vector line deltas from the line start point", async () => {
  const { templateV2UiToHtml } = await rendererPromise;
  const html = templateV2UiToHtml({
    elements: [
      {
        type: "vector",
        points: [
          { x: 100, y: 80 },
          { x: 60, y: 80 },
        ],
        closed: false,
        stroke: { color: "#111111", width: 3 },
      },
      {
        type: "vector",
        points: [
          { x: 120, y: 200 },
          { x: 120, y: 150 },
        ],
        closed: false,
        stroke: { color: "#222222", width: 2 },
      },
    ],
  });

  assert.ok(html);
  assert.match(html, /left:60px;top:80px;width:40px;height:3px;/);
  assert.match(html, /<polyline points="40,0 0,0" fill="none" stroke="#111111" stroke-width="3"/);
  assert.match(html, /left:120px;top:150px;width:2px;height:50px;/);
  assert.match(html, /<polyline points="0,50 0,0" fill="none" stroke="#222222" stroke-width="2"/);
});

test("renders point-based vector shapes without position or size", async () => {
  const { templateV2UiToHtml } = await rendererPromise;
  const html = templateV2UiToHtml({
    elements: [
      {
        type: "vector",
        points: [
          { x: 20, y: 40 },
          { x: 140, y: 40 },
          { x: 180, y: 120 },
          { x: 20, y: 120 },
        ],
        fill: { color: "#F4F3FF" },
        stroke: { color: "#7A5AF8", width: 2 },
      },
    ],
  });

  assert.ok(html);
  assert.match(html, /left:20px;top:40px;width:160px;height:80px;/);
  assert.match(html, /<polygon points="0,0 120,0 160,80 0,80" fill="#F4F3FF" stroke="#7A5AF8" stroke-width="2"/);
});

test("renders vector shapes with corner radii", async () => {
  const { templateV2UiToHtml } = await rendererPromise;
  const html = templateV2UiToHtml({
    elements: [
      {
        type: "vector",
        points: [
          { x: 20, y: 40 },
          { x: 140, y: 40 },
          { x: 140, y: 120 },
          { x: 20, y: 120 },
        ],
        closed: true,
        corner_radii: [16, 16, 16, 16],
        fill: { color: "#F4F3FF" },
        stroke: { color: "#7A5AF8", width: 2 },
      },
    ],
  });

  assert.ok(html);
  assert.match(html, /<polygon points="0,16 0\.25,12\.25/);
});

test("renders smooth vector curves through original points", async () => {
  const { templateV2UiToHtml } = await rendererPromise;
  const html = templateV2UiToHtml({
    elements: [
      {
        type: "vector",
        points: [
          { x: 0, y: 0 },
          { x: 50, y: 100 },
          { x: 100, y: 0 },
        ],
        closed: false,
        curve: { type: "smooth", tension: 0.4, segments: 4 },
        stroke: { color: "#111111", width: 2 },
      },
    ],
  });

  assert.ok(html);
  assert.match(html, /<polyline points="0,0 .* 50,100 .* 100,0"/);
});

test("renders legacy vector shape aliases", async () => {
  const { templateV2UiToHtml } = await rendererPromise;
  const html = templateV2UiToHtml({
    elements: [
      {
        type: "rectangle",
        position: { x: 40, y: 50 },
        size: { width: 100, height: 60 },
        fill: { color: "#F4F3FF" },
        stroke: { color: "#7A5AF8", width: 4 },
      },
      {
        type: "ellipse",
        position: { x: 80, y: 100 },
        size: { width: 40, height: 30 },
        fill: { color: "#112233" },
      },
      {
        type: "line",
        position: { x: 200, y: 100 },
        size: { width: -40, height: 20 },
        stroke: { color: "#222222", width: 5 },
      },
    ],
  });

  assert.ok(html);
  assert.match(html, /left:40px;top:50px;width:100px;height:60px;/);
  assert.match(html, /<polygon points="0,0 100,0 100,60 0,60" fill="#F4F3FF" stroke="#7A5AF8" stroke-width="4"/);
  assert.match(html, /left:80px;top:100px;width:40px;height:30px;/);
  assert.match(html, /background-color:#112233;.*border-radius:50%/);
  assert.match(html, /left:160px;top:100px;width:40px;height:20px;/);
  assert.match(html, /<polyline points="40,0 0,20" fill="none" stroke="#222222" stroke-width="5"/);
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
