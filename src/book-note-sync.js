/**
 * Append-only book-note synchronization.
 * Only adds missing highlights, never rewrites existing annotation blocks.
 * This safeguards user edits until a two-way comment reconciliation is available.
 */
function safeName(value) {
  return String(value || "Untitled").replace(/[\\/:*?"<>|#^\[\]]/g, "").replace(/[. ]+$/g, "").trim().slice(0, 90) || "Untitled";
}
function pathJoin(folder, name) {
  return folder ? folder.replace(/\/+$/g, "") + "/" + name : name;
}
async function ensureFolder(vault, folder) {
  if (!folder) return;
  const chunks = folder.split("/").filter(Boolean);
  let current = "";
  for (const part of chunks) {
    current = pathJoin(current, part);
    if (!vault.getAbstractFileByPath(current)) {
      try { await vault.createFolder(current); }
      catch (e) { if (!vault.getAbstractFileByPath(current)) throw e; }
    }
  }
}
function quoteBlock(bookPath, hl) {
  const id = String(hl.id);
  const text = String(hl.text || "").replace(/\s+/g, " ").trim();
  const escaped = text.replace(/^/gm, "> ");
  const link = "obsidian://elton-reader?book=" + encodeURIComponent(bookPath) + "&block=" + encodeURIComponent(hl.block ?? 0);
  const comment = String(hl.comment || "").trim();
  return [
    "<!-- br:annotation id=" + id + " -->",
    escaped,
    "",
    "[↪ К месту в книге](" + link + ")",
    "",
    "**Мой комментарий**",
    comment,
    "<!-- br:end -->",
  ].join("\n");
}
/**
 * @returns {Promise<void>}
 * A single queue per book must be provided by the caller to avoid same-process
 * races on the first note creation. Cross-device conflicts still need testing.
 */
export async function appendHighlightToBookNote(app, file, hl, folder = "Book Notes") {
  if (!hl?.id || !hl?.text || !file?.path) return;
  const base = safeName(file.basename);
  const dir = String(folder || "").replace(/^\/+|\/+$/g, "");
  await ensureFolder(app.vault, dir);
  let targetPath = pathJoin(dir, base + ".md");
  let existingFile = app.vault.getAbstractFileByPath(targetPath);
  // Do not mutate an unrelated note that happens to share the basename.
  if (existingFile) {
    const data = await app.vault.read(existingFile);
    if (!data.includes("<!-- br:book " + file.path + " -->")) {
      targetPath = pathJoin(dir, base + " — " + safeName(file.extension || "book") + ".md");
      existingFile = app.vault.getAbstractFileByPath(targetPath);
      if (existingFile) {
        const second = await app.vault.read(existingFile);
        if (!second.includes("<!-- br:book " + file.path + " -->")) {
          throw new Error("Book note name collision: " + targetPath);
        }
      }
    }
  }
  const marker = "<!-- br:book " + file.path + " -->";
  const initial = "# " + base + "\n\n" + marker + "\n\n[Открыть книгу](obsidian://open?file=" + encodeURIComponent(file.path) + ")\n\n## Выделения\n";
  const snippet = "\n" + quoteBlock(file.path, hl) + "\n";
  if (!existingFile) {
    try { await app.vault.create(targetPath, initial + snippet); return; }
    catch (e) {
      existingFile = app.vault.getAbstractFileByPath(targetPath);
      if (!existingFile) throw e;
    }
  }
  const process = (data) => {
    if (!data.includes(marker)) throw new Error("Book note has a different source");
    if (data.includes("<!-- br:annotation id=" + String(hl.id) + " -->")) return data;
    return data.replace(/\s*$/, "") + "\n" + snippet;
  };
  if (typeof app.vault.process === "function") await app.vault.process(existingFile, process);
  else await app.vault.modify(existingFile, process(await app.vault.read(existingFile)));
}

/**
 * Locate a managed highlight. The user's surrounding Markdown remains untouched.
 * A comment is the text between the comment heading and the closing marker.
 */
export function findAnnotationComment(markdown, id) {
  const start = "<!-- br:annotation id=" + String(id) + " -->";
  const begin = markdown.indexOf(start);
  if (begin < 0) return null;
  const end = markdown.indexOf("<!-- br:end -->", begin + start.length);
  if (end < 0) return null;
  const header = "**Мой комментарий**";
  const heading = markdown.indexOf(header, begin + start.length);
  if (heading < 0 || heading >= end) return null;
  const from = heading + header.length;
  return { value: markdown.slice(from, end).trim(), from, end };
}

export function replaceAnnotationComment(markdown, id, value) {
  const found = findAnnotationComment(markdown, id);
  if (!found) return markdown;
  return markdown.slice(0, found.from) + "\n" + String(value || "").trim() + "\n" + markdown.slice(found.end);
}

export async function readBookNoteComment(app, file, id, folder = "Book Notes") {
  const note = await findExistingBookNote(app, file, folder);
  if (!note) return { found: false, comment: "" };
  const content = await app.vault.read(note);
  const result = findAnnotationComment(content, id);
  return result ? { found: true, comment: result.value } : { found: false, comment: "" };
}

export async function findExistingBookNote(app, file, folder = "Book Notes") {
  if (!file?.path) return null;
  const dir = String(folder || "").replace(/^\\/+|\\/+$/g, "");
  const base = safeName(file.basename);
  const marker = "<!-- br:book " + file.path + " -->";
  for (const name of [base + ".md", base + " — " + safeName(file.extension || "book") + ".md"]) {
    const candidate = app.vault.getAbstractFileByPath(pathJoin(dir, name));
    if (candidate && (await app.vault.read(candidate)).includes(marker)) return candidate;
  }
  return null;
}

export async function updateBookNoteComment(app, file, id, value, folder = "Book Notes") {
  const note = await findExistingBookNote(app, file, folder);
  if (!note) return false;
  let found = false;
  const edit = (markdown) => {
    if (!findAnnotationComment(markdown, id)) return markdown;
    found = true;
    return replaceAnnotationComment(markdown, id, value);
  };
  if (typeof app.vault.process === "function") await app.vault.process(note, edit);
  else await app.vault.modify(note, edit(await app.vault.read(note)));
  return found;
}
