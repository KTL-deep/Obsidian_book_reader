// Persistent PDF extraction cache. Original PDFs remain the source of truth.
// Cache stores ONLY extracted HTML, page geometry and TOC, not PDF.js document
// objects or rendered canvases. The PDF document is reopened for lazy figures.
const CACHE_VERSION = 1;
function hashPath(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
function cacheRoot(app) {
  return (app.vault.configDir || ".obsidian") + "/plugins/ktl-book-reader/pdf-cache";
}
export function pdfCacheDescriptor(file, settings = {}) {
  return {
    version: CACHE_VERSION,
    path: file.path,
    size: file.stat?.size ?? -1,
    mtime: file.stat?.mtime ?? -1,
    displayMode: settings.pdfDisplayMode === "original" ? "original" : "reflow",
    showFigures: settings.pdfShowFiguresOnTextPages === true,
  };
}
function cacheFile(app, file, settings) {
  const mode = settings.pdfDisplayMode === "original" ? "original" : "reflow";
  const figures = settings.pdfShowFiguresOnTextPages === true ? "figures" : "text";
  return cacheRoot(app) + "/" + hashPath(file.path) + "-" + mode + "-" + figures + ".json";
}
export async function loadPdfExtractionCache(app, file, settings = {}) {
  try {
    const data = JSON.parse(await app.vault.adapter.read(cacheFile(app, file, settings)));
    if (JSON.stringify(data?.descriptor) !== JSON.stringify(pdfCacheDescriptor(file, settings))) return null;
    if (typeof data.html !== "string" || !Array.isArray(data.outline) ||
        !data.figRects || typeof data.figRects !== "object") return null;
    return { html: data.html, outline: data.outline, figRects: data.figRects };
  } catch {
    return null; // invalid, outdated or missing cache: regenerate normally
  }
}
export async function savePdfExtractionCache(app, file, settings, result) {
  const root = cacheRoot(app);
  const adapter = app.vault.adapter;
  try {
    if (!await adapter.exists(root)) await adapter.mkdir(root);
    const body = JSON.stringify({
      descriptor: pdfCacheDescriptor(file, settings),
      html: result.html,
      outline: result.outline,
      figRects: result.figRects,
    });
    const dst = cacheFile(app, file);
    const temp = dst + ".tmp";
    await adapter.write(temp, body);
    // Rename is available on Obsidian filesystem adapters (mobile and desktop).
    if (await adapter.exists(dst)) await adapter.remove(dst);
    await adapter.rename(temp, dst);
  } catch (err) {
    console.warn("Book Reader: PDF cache write failed; normal reading continues", err);
  }
}
