import test from "node:test";
import assert from "node:assert/strict";
import { extractReflowLines, groupReflowParagraphs, isPotentiallyReflowable } from "../src/pdf-reflow.js";

function item(str, x, y, width = 40, hasEOL = false) {
  return { str, transform: [1, 0, 0, 1, x, y], width, height: 10, hasEOL };
}

test("joins runs into a line without dropping source indices", () => {
  const lines = extractReflowLines([
    item("Hello", 10, 100, 30),
    item("world", 45, 100, 30, true),
    item("Next line", 10, 85),
  ], 4);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0].itemIndices, [0, 1]);
  assert.equal(lines[0].text, "Hello world");
  assert.equal(lines[0].page, 4);
});

test("groups nearby lines and keeps page boundaries", () => {
  const paragraphs = groupReflowParagraphs([
    { text: "First", page: 1, y: 100, itemIndices: [0] },
    { text: "second", page: 1, y: 90, itemIndices: [1] },
    { text: "New page", page: 2, y: 100, itemIndices: [0] },
  ]);
  assert.deepEqual(paragraphs.map(p => p.text), ["First second", "New page"]);
});

test("rejects empty and malformed text layers", () => {
  assert.equal(isPotentiallyReflowable([]), false);
  assert.equal(isPotentiallyReflowable(Array.from({ length: 5 }, () => ({ str: "x" }))), false);
});
