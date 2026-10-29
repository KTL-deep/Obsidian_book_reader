import test from "node:test";
import assert from "node:assert/strict";
import { appendHighlightToBookNote, readBookNoteComment, updateBookNoteComment } from "../src/book-note-sync.js";

function mockApp() {
  const files = new Map();
  const folders = new Set();
  const vault = {
    getAbstractFileByPath: path => files.get(path) || (folders.has(path) ? { path, folder: true } : null),
    createFolder: async path => { folders.add(path); },
    create: async (path, data) => {
      if (files.has(path)) throw new Error("already exists");
      const file = { path, content: data };
      files.set(path, file);
      return file;
    },
    read: async file => file.content,
    process: async (file, updater) => { file.content = updater(file.content); },
  };
  return { vault, files };
}
const book = { path: "Books/Novel.epub", basename: "Novel", extension: "epub" };
test("first highlight creates one note", async () => {
  const app = mockApp();
  await appendHighlightToBookNote(app, book, { id: "h1", text: "First sentence", block: 2 }, "Notes/Books");
  assert.equal(app.files.size, 1);
  assert.match(app.files.get("Notes/Books/Novel.md").content, /First sentence/);
});
test("append is idempotent and preserves comment edits", async () => {
  const app = mockApp();
  const hl = { id: "h1", text: "Sentence", block: 2 };
  await appendHighlightToBookNote(app, book, hl, "Notes");
  const note = app.files.get("Notes/Novel.md");
  note.content = note.content.replace("**Мой комментарий**", "**Мой комментарий**\nMy own thought");
  await appendHighlightToBookNote(app, book, hl, "Notes");
  await appendHighlightToBookNote(app, book, { id: "h2", text: "Second" }, "Notes");
  assert.equal((note.content.match(/br:annotation id=h1/g) || []).length, 1);
  assert.match(note.content, /My own thought/);
  assert.match(note.content, /Second/);
});
test("will not overwrite unrelated note of same name", async () => {
  const app = mockApp();
  await app.vault.create("Notes/Novel.md", "# My unrelated note");
  await appendHighlightToBookNote(app, book, { id: "h1", text: "Quote" }, "Notes");
  assert.equal(app.files.get("Notes/Novel.md").content, "# My unrelated note");
  assert.ok(app.files.has("Notes/Novel — epub.md"));
});

test("comments round-trip without changing other quotes", async () => {
  const app = mockApp();
  await appendHighlightToBookNote(app, book, { id: "h1", text: "First" }, "Notes");
  await appendHighlightToBookNote(app, book, { id: "h2", text: "Second" }, "Notes");
  assert.equal(await updateBookNoteComment(app, book, "h1", "My thought", "Notes"), true);
  assert.deepEqual(await readBookNoteComment(app, book, "h1", "Notes"), { found: true, comment: "My thought" });
  assert.deepEqual(await readBookNoteComment(app, book, "h2", "Notes"), { found: true, comment: "" });
  await updateBookNoteComment(app, book, "h1", "", "Notes");
  assert.equal((await readBookNoteComment(app, book, "h1", "Notes")).comment, "");
});
