# Book Reader Custom — development plan

Forked from [Elton Labs Book Reader](https://github.com/swayinfo/elton-reader) (MIT License). Preserve the original LICENSE and copyright notices.

## Product requirements
- Obsidian desktop (Windows) and mobile (Android), offline-first.
- Read EPUB, FB2, PDF.
- Reading modes: horizontal slide, simulated page curl, continuous vertical scroll.
- PDF original layout and optional adaptive **reflow**. MVP reflow targets searchable single-column text PDFs; preserve an immediate fallback to original layout.
- Four-color highlights, anchored to source positions, and editable comments.
- Automatically create **one Markdown note per book** on the first highlight. Synchronize highlights with managed blocks without overwriting user-edited comments or arbitrary Markdown.
- Configurable book and note directories, per-book reading positions, TOC, search, themes, bookmarks, library and reading statistics.
- Swipe/tap edge navigation on mobile.
- Data remains in vault; work with existing vault sync without silently discarding conflicting content.

## Implementation stages

### 0. Audit and safeguards
- Map reader classes and persistent schemas in `src/main.js`.
- Keep the upstream default branch untouched and retain the MIT LICENSE.
- Set distinct plugin ID **only after** auditing references to the old ID and migration behavior. Existing upstream installations must not be unintentionally overwritten.
- Add smoke tests for desktop, Android and existing EPUB/FB2/PDF reading.

### 1. Reflow proof of concept
- Extract searchable PDF text items with PDF.js, normalizing text runs while retaining source page references and rectangles.
- Construct paragraphs from lines; show reflow as HTML with selectable text.
- Detect unsupported layouts (multicolumn, unextractable text, tables) and default back to original.
- Connect selections to source-text spans and source PDF rectangles; confirm highlights survive mode switches.

### 2. Notes and highlights
- Stable per-book and per-highlight IDs; create note automatically on first highlight.
- One book note, chapter sections, managed annotation markers, user-editable comments.
- Two-way navigation, lossless updates, and conflict checks.

### 3. Reading modes
- Horizontal slides and vertical scroll; page curl as opt-in feature with reduced-motion fallback.
- Preserve logical positions on viewport, font and mode changes.

### 4. Library and tracking
- Validate/extend existing TOC, search, themes, bookmarks, library and reading-time statistics.
- Efficient per-book state writes, sync/conflict behavior and mobile performance tests.

## Acceptance
Test with: searchable single-column PDF, two-column scientific PDF, scanned PDF, EPUB and FB2 on both target platforms. Existing formats must remain functional. Failures in reflow must never prevent reading the original PDF.

## Current status
Branch initialized. This document is the roadmap; features listed above are not implied to be implemented yet.
