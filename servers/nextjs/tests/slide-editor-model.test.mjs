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

test("detects two-point open vector lines", async () => {
  const { isVectorLineElement } = await modelPromise;
  const points = [
    { x: 0, y: 0 },
    { x: 80, y: 0 },
  ];

  assert.equal(
    isVectorLineElement({ type: "vector", points, closed: false }),
    true,
  );
  assert.equal(isVectorLineElement({ type: "vector", points }), true);
  assert.equal(
    isVectorLineElement({ type: "vector", points, closed: true }),
    false,
  );
  assert.equal(
    isVectorLineElement({
      type: "vector",
      points: [...points, { x: 80, y: 40 }],
      closed: false,
    }),
    false,
  );
});

test("translates vector shape points without changing smooth curve settings", async () => {
  const { translateVectorElement } = await modelPromise;
  const curve = { type: "smooth", tension: 0.6, segments: 9 };
  const translated = translateVectorElement(
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

test("toolbar merge removes nullable vector style fields", async () => {
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
    fill: { color: "#FFFFFF", opacity: 1 },
    stroke: { color: "#111111", width: 2 },
    shadow: { color: "#000000", blur: 8, opacity: 0.2 },
  };

  const merged = mergeEditorToolbarElement(
    current,
    {
      ...current,
      position: { x: 120, y: 80 },
      size: { width: 50, height: 20 },
      fill: null,
      stroke: null,
      shadow: null,
    },
    { x: 120, y: 80, width: 50, height: 20 },
  );

  assert.equal(Object.hasOwn(merged, "fill"), false);
  assert.equal(Object.hasOwn(merged, "stroke"), false);
  assert.equal(Object.hasOwn(merged, "shadow"), false);
});

test("toolbar merge removes nullable shape style fields", async () => {
  const { mergeEditorToolbarElement } = await modelPromise;
  const current = {
    type: "rectangle",
    position: { x: 10, y: 20 },
    size: { width: 50, height: 20 },
    fill: { color: "#FFFFFF", opacity: 1 },
    stroke: { color: "#111111", width: 2 },
    shadow: { color: "#000000", blur: 8, opacity: 0.2 },
  };

  const merged = mergeEditorToolbarElement(
    current,
    {
      ...current,
      position: { x: 10, y: 20 },
      size: { width: 50, height: 20 },
      fill: null,
      stroke: null,
      shadow: null,
    },
    { x: 10, y: 20, width: 50, height: 20 },
  );

  assert.equal(Object.hasOwn(merged, "fill"), false);
  assert.equal(Object.hasOwn(merged, "stroke"), false);
  assert.equal(Object.hasOwn(merged, "shadow"), false);
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

test("diagonal component resize scales vector points", async () => {
  const { componentBox, resizeComponent } = await modelPromise;
  const component = {
    position: { x: 100, y: 50 },
    elements: [
      {
        type: "vector",
        points: [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 40, y: 20 },
        ],
        closed: true,
      },
    ],
  };

  const next = resizeComponent(component, {
    x: 100,
    y: 50,
    width: 80,
    height: 60,
    scaleX: 2,
    scaleY: 3,
    rotation: 0,
  });

  assert.equal(Object.hasOwn(next, "size"), false);
  assert.deepEqual(next.elements[0].points, [
    { x: 0, y: 0 },
    { x: 80, y: 0 },
    { x: 80, y: 60 },
  ]);
  assert.deepEqual(componentBox(next), {
    x: 100,
    y: 50,
    width: 80,
    height: 60,
  });
});

test("updates a single-vector component boundary after vector shape edits", async () => {
  const { componentBox, updateElementInUi } = await modelPromise;
  const next = updateElementInUi(
    {
      components: [
        {
          position: { x: 100, y: 50 },
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
  assert.equal(Object.hasOwn(next.components[0], "size"), false);
  assert.deepEqual(componentBox(next.components[0]), {
    x: 90,
    y: 55,
    width: 70,
    height: 75,
  });
  assert.deepEqual(next.components[0].elements[0].points, [
    { x: 0, y: 0 },
    { x: 70, y: 0 },
    { x: 70, y: 75 },
  ]);
});

test("updates a single-vector component boundary after vector shape drag", async () => {
  const {
    componentBox,
    translateVectorElement,
    updateElementInUi,
  } = await modelPromise;
  const next = updateElementInUi(
    {
      components: [
        {
          position: { x: 100, y: 50 },
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
    (element) => translateVectorElement(element, { x: 25, y: 10 }),
  );

  assert.deepEqual(next.components[0].position, { x: 125, y: 60 });
  assert.deepEqual(componentBox(next.components[0]), {
    x: 125,
    y: 60,
    width: 40,
    height: 40,
  });
  assert.deepEqual(next.components[0].elements[0].points, [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 40 },
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

test("wraps inserted vector elements without component padding", async () => {
  const { componentBox, insertedElementToComponent } = await modelPromise;
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

  assert.deepEqual(component.position, { x: 134, y: 134 });
  assert.equal(Object.hasOwn(component, "size"), false);
  assert.deepEqual(componentBox(component), {
    x: 134,
    y: 134,
    width: 384,
    height: 192,
  });
  assert.deepEqual(component.elements[0].points, [
    { x: 0, y: 0 },
    { x: 384, y: 0 },
    { x: 384, y: 192 },
    { x: 0, y: 192 },
  ]);
});

test("selects inserted vector lines directly", async () => {
  const {
    appendInsertedContent,
    selectionForInsertedComponent,
  } = await modelPromise;
  const ui = appendInsertedContent(
    { components: [] },
    [
      {
        type: "vector",
        points: [
          { x: 134, y: 218 },
          { x: 569, y: 219 },
        ],
        closed: false,
        stroke: { color: "101323", width: 2 },
      },
    ],
    [],
    "Line",
  );

  assert.deepEqual(selectionForInsertedComponent(ui, 0), {
    kind: "element",
    componentIndex: 0,
    elementPath: [0],
  });
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
