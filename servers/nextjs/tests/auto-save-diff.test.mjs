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
  const candidates = [basePath, `${basePath}.ts`, `${basePath}.tsx`];
  return candidates.find((candidate) => existsSync(candidate)) ?? basePath;
}

async function loadHelpers() {
  const outDir = await mkdtemp(path.join(tmpdir(), "auto-save-diff-test-"));
  const outfile = path.join(outDir, "auto-save-diff.mjs");

  await build({
    entryPoints: [
      path.join(
        projectRoot,
        "app/(presentation-generator)/presentation/utils/autoSaveDiff.ts"
      ),
    ],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
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

const helpersPromise = loadHelpers();

function presentation() {
  return {
    id: "presentation-1",
    title: "Quarterly review",
    theme: null,
    slides: [
      { id: "slide-1", index: 0, content: { title: "One" } },
      { id: "slide-2", index: 1, content: { title: "Two" } },
    ],
  };
}

test("reports no changes for the acknowledged presentation", async () => {
  const { createAutoSaveSnapshot, getAutoSaveChanges } = await helpersPromise;
  const data = presentation();

  assert.deepEqual(
    getAutoSaveChanges(createAutoSaveSnapshot(data), data),
    {
      structuralChange: false,
      changedSlides: [],
      metadataChanged: false,
    }
  );
});

test("returns only slides whose content changed", async () => {
  const { createAutoSaveSnapshot, getAutoSaveChanges } = await helpersPromise;
  const original = presentation();
  const updated = structuredClone(original);
  updated.slides[1].content.title = "Updated two";

  const changes = getAutoSaveChanges(createAutoSaveSnapshot(original), updated);

  assert.equal(changes.structuralChange, false);
  assert.deepEqual(changes.changedSlides.map((slide) => slide.id), ["slide-2"]);
  assert.equal(changes.metadataChanged, false);
});

test("reports multiple independently changed slides", async () => {
  const { createAutoSaveSnapshot, getAutoSaveChanges } = await helpersPromise;
  const original = presentation();
  const updated = structuredClone(original);
  updated.slides[0].content.title = "Updated one";
  updated.slides[1].content.title = "Updated two";

  const changes = getAutoSaveChanges(createAutoSaveSnapshot(original), updated);

  assert.deepEqual(changes.changedSlides.map((slide) => slide.id), [
    "slide-1",
    "slide-2",
  ]);
});

test("separates metadata changes from slide updates", async () => {
  const { createAutoSaveSnapshot, getAutoSaveChanges } = await helpersPromise;
  const original = presentation();
  const updated = structuredClone(original);
  updated.title = "New title";

  const changes = getAutoSaveChanges(createAutoSaveSnapshot(original), updated);

  assert.equal(changes.metadataChanged, true);
  assert.deepEqual(changes.changedSlides, []);
  assert.equal(changes.structuralChange, false);
});

test("uses the structural fallback for reorder, add, delete, or invalid indices", async () => {
  const { createAutoSaveSnapshot, getAutoSaveChanges } = await helpersPromise;
  const original = presentation();
  const snapshot = createAutoSaveSnapshot(original);

  const reordered = structuredClone(original);
  reordered.slides.reverse();
  reordered.slides.forEach((slide, index) => {
    slide.index = index;
  });

  const added = structuredClone(original);
  added.slides.push({ id: "slide-3", index: 2, content: { title: "Three" } });

  const deleted = structuredClone(original);
  deleted.slides.pop();

  const invalidIndex = structuredClone(original);
  invalidIndex.slides[1].index = 3;

  for (const data of [reordered, added, deleted, invalidIndex]) {
    const changes = getAutoSaveChanges(snapshot, data);
    assert.equal(changes.structuralChange, true);
    assert.deepEqual(changes.changedSlides, []);
  }
});
