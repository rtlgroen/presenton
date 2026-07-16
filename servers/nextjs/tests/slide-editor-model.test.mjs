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

async function loadModel() {
  const outDir = await mkdtemp(path.join(tmpdir(), "slide-editor-model-test-"));
  const outfile = path.join(outDir, "model.mjs");

  await build({
    entryPoints: [
      path.join(projectRoot, "components", "slide-editor", "model", "model.ts"),
    ],
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

async function loadShapeToolbar() {
  const outDir = await mkdtemp(path.join(tmpdir(), "shape-toolbar-test-"));
  const outfile = path.join(outDir, "shape-toolbar.mjs");

  await build({
    entryPoints: [
      path.join(
        projectRoot,
        "components",
        "slide-editor",
        "shapes",
        "ShapeToolbar.tsx",
      ),
    ],
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

const modelPromise = loadModel();
const shapeToolbarPromise = loadShapeToolbar();

test("adds and removes vector shape points", async () => {
  const {
    insertVectorPointInElement,
    removeVectorPointFromElement,
  } = await modelPromise;
  const element = {
    type: "vector",
    points: [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 30 },
    ],
    closed: true,
    corner_radii: [1, 2, 3],
    curve: {
      type: "smooth",
      tension: 0.35,
      segments: 12,
    },
  };

  const added = insertVectorPointInElement(element, 0, { x: 15, y: 0 });
  assert.deepEqual(added.points, [
    { x: 0, y: 0 },
    { x: 15, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 30 },
  ]);
  assert.deepEqual(added.corner_radii, [1, 0, 2, 3]);
  assert.deepEqual(added.curve, element.curve);

  const removed = removeVectorPointFromElement(added, 1);
  assert.deepEqual(removed.points, element.points);
  assert.deepEqual(removed.corner_radii, element.corner_radii);
  assert.deepEqual(removed.curve, element.curve);

  assert.equal(removeVectorPointFromElement(removed, 0), removed);
});

test("keeps open vector shapes at a minimum of two points", async () => {
  const { removeVectorPointFromElement } = await modelPromise;
  const line = {
    type: "vector",
    points: [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
    ],
    closed: false,
  };

  assert.equal(removeVectorPointFromElement(line, 0), line);
});

test("translates vector shape points without changing smooth curve settings", async () => {
  const { translateVectorShapeElement } = await modelPromise;
  const curve = { type: "smooth", tension: 0.6, segments: 9 };
  const translated = translateVectorShapeElement(
    {
      type: "vector",
      points: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ],
      closed: false,
      curve,
    },
    { x: 4, y: -6 },
  );

  assert.deepEqual(translated.points, [
    { x: 14, y: 14 },
    { x: 34, y: 34 },
  ]);
  assert.deepEqual(translated.curve, curve);
});

test("merges vector frame edits into point geometry", async () => {
  const { mergeEditorToolbarElement } = await modelPromise;
  const current = {
    type: "vector",
    points: [
      { x: 10, y: 20 },
      { x: 60, y: 20 },
      { x: 60, y: 40 },
      { x: 10, y: 40 },
    ],
    closed: true,
    rotation: 15,
    corner_radii: [2, 2, 2, 2],
    stroke: { color: "#111111", width: 2 },
  };

  const merged = mergeEditorToolbarElement(
    current,
    {
      ...current,
      position: { x: 140, y: 85 },
      size: { width: 100, height: 40 },
      rotation: 30,
      stroke: { color: "#222222", width: 3 },
    },
    { x: 120, y: 80, width: 50, height: 20 },
  );

  assert.deepEqual(merged.points, [
    { x: 30, y: 25 },
    { x: 130, y: 25 },
    { x: 130, y: 65 },
    { x: 30, y: 65 },
  ]);
  assert.equal(merged.rotation, 30);
  assert.deepEqual(merged.corner_radii, [4, 4, 4, 4]);
  assert.deepEqual(merged.stroke, { color: "#222222", width: 3 });
  assert.equal(merged.__presenton_manual_position, true);
  assert.equal(Object.hasOwn(merged, "position"), false);
  assert.equal(Object.hasOwn(merged, "size"), false);
});

test("merges vector rotation without shifting points", async () => {
  const { mergeEditorToolbarElement } = await modelPromise;
  const current = {
    type: "vector",
    points: [
      { x: 10, y: 20 },
      { x: 60, y: 20 },
      { x: 60, y: 40 },
    ],
    closed: true,
    rotation: 0,
  };

  const merged = mergeEditorToolbarElement(
    current,
    {
      ...current,
      position: { x: 120, y: 80 },
      size: { width: 50, height: 20 },
      rotation: 45,
    },
    { x: 120, y: 80, width: 50, height: 20 },
  );

  assert.deepEqual(merged.points, current.points);
  assert.equal(merged.rotation, 45);
  assert.equal(Object.hasOwn(merged, "position"), false);
  assert.equal(Object.hasOwn(merged, "size"), false);
});

test("samples smooth curves through the original vector points", async () => {
  const { polygonPointsForElement } = await modelPromise;
  const points = polygonPointsForElement({
    type: "vector",
    points: [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 0 },
    ],
    closed: false,
    curve: { type: "smooth", tension: 0.4, segments: 4 },
  });

  assert.deepEqual(points[0], { x: 0, y: 0 });
  assert.deepEqual(points[4], { x: 50, y: 100 });
  assert.deepEqual(points[8], { x: 100, y: 0 });
});

test("updates a single-vector component boundary after vector shape edits", async () => {
  const { updateElementInUi } = await modelPromise;
  const next = updateElementInUi(
    {
      components: [
        {
          position: { x: 100, y: 50 },
          size: { width: 40, height: 40 },
          elements: [
            {
              type: "vector",
              points: [
                { x: 0, y: 0 },
                { x: 40, y: 0 },
                { x: 40, y: 40 },
              ],
              closed: true,
            },
          ],
        },
      ],
    },
    { kind: "element", componentIndex: 0, elementPath: [0] },
    (element) => ({
      ...element,
      points: [
        { x: -10, y: 5 },
        { x: 60, y: 5 },
        { x: 60, y: 80 },
      ],
    }),
  );

  assert.deepEqual(next.components[0].position, { x: 90, y: 55 });
  assert.deepEqual(next.components[0].size, { width: 70, height: 75 });
  assert.deepEqual(next.components[0].elements[0].points, [
    { x: 0, y: 0 },
    { x: 70, y: 0 },
    { x: 70, y: 75 },
  ]);
});

test("preserves inserted vector elements", async () => {
  const { rawElementFromInsertedElement } = await modelPromise;
  const element = rawElementFromInsertedElement({
    type: "vector",
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ],
    closed: true,
    fill: { color: "#FFFFFF" },
  });

  assert.equal(element.type, "vector");
  assert.equal(element.points.length, 4);
  assert.equal(element.closed, true);
});

test("wraps inserted elements in a padded component frame", async () => {
  const { insertedElementToComponent } = await modelPromise;
  const component = insertedElementToComponent(
    {
      type: "vector",
      points: [
        { x: 134, y: 134 },
        { x: 518, y: 134 },
        { x: 518, y: 326 },
        { x: 134, y: 326 },
      ],
      closed: true,
      fill: { color: "F4F3FF", opacity: 1 },
      stroke: { color: "7A5AF8", width: 1.5 },
    },
    "Rectangle",
    0,
  );

  assert.deepEqual(component.position, { x: 114, y: 114 });
  assert.deepEqual(component.size, { width: 424, height: 232 });
  assert.deepEqual(component.elements[0].points, [
    { x: 20, y: 20 },
    { x: 404, y: 20 },
    { x: 404, y: 212 },
    { x: 20, y: 212 },
  ]);
});

test("normalizes vector shape toolbar curve options", async () => {
  const { curveForMode, normalizedSegments } = await shapeToolbarPromise;
  const element = {
    type: "vector",
    points: [
      { x: 0, y: 0 },
      { x: 90, y: 0 },
    ],
    curve: null,
  };

  assert.equal(normalizedSegments(-4), 1);
  assert.equal(normalizedSegments(23.6), 24);
  assert.equal(normalizedSegments(128), 96);
  assert.equal(curveForMode(element, "none"), null);
  assert.deepEqual(curveForMode(element, "smooth"), {
    type: "smooth",
    tension: 0.4,
    segments: 16,
  });
});
