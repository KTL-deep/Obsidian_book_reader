import test from "node:test";
import assert from "node:assert/strict";
import { pdfCacheDescriptor, loadPdfExtractionCache, savePdfExtractionCache } from "../src/pdf-extraction-cache.js";

function fixture() {
  const files = new Map();
  const adapter = {
    exists: async p => files.has(p),
    mkdir: async p => files.set(p, "<dir>"),
    read: async p => { if (!files.has(p)) throw new Error("missing"); return files.get(p); },
    write: async (p, value) => { files.set(p, value); },
    rename: async (from, to) => { files.set(to, files.get(from)); files.delete(from); },
    remove: async p => { files.delete(p); },
  };
  return { app: { vault: { configDir: ".obsidian", adapter } }, files };
}
const file = { path: "Books/Research.pdf", stat: { size: 1234, mtime: 100 } };
const settings = { pdfDisplayMode: "reflow", pdfShowFiguresOnTextPages: false };
const result = { html: "<p>Research</p>", outline: [], figRects: {} };
test("initial cache miss followed by successful load", async () => {
  const { app } = fixture();
  assert.equal(await loadPdfExtractionCache(app, file, settings), null);
  await savePdfExtractionCache(app, file, settings, result);
  assert.deepEqual(await loadPdfExtractionCache(app, file, settings), result);
});
test("updated PDF invalidates cached extraction", async () => {
  const { app } = fixture();
  await savePdfExtractionCache(app, file, settings, result);
  assert.equal(await loadPdfExtractionCache(app, { ...file, stat: { size: 1234, mtime: 101 } }, settings), null);
});
test("display mode changes invalidate old cache", async () => {
  const { app } = fixture();
  await savePdfExtractionCache(app, file, settings, result);
  assert.equal(await loadPdfExtractionCache(app, file, { ...settings, pdfDisplayMode: "original" }), null);
});
test("cache is separated by PDF path", () => {
  const other = { ...file, path: "Books/Other.pdf" };
  assert.notDeepEqual(pdfCacheDescriptor(file, settings), pdfCacheDescriptor(other, settings));
});
