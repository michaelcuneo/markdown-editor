# Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased]

- ***

## [0.0.8] 🔥 - (Latest)

### Added

- Image manipulation controls for replace/remove/caption/resize workflows in-editor.
- Optimization workflow improvements including responsive variant generation and `srcSet` handling.

### Changed

- Demo behavior now keeps image queue local/edit-only for editor demonstration flows.
- Documentation updated to focus image sections on manipulation + optimization (provider upload docs deferred).
- Long-document editing now keeps controls accessible with a capped editor viewport and sticky toolbar.

### Fixed

- Fixed image replace behavior that could retain stale responsive attributes.
- Fixed dropped-image flicker/disappear paths caused by premature direct URL fetch attempts.
- Fixed raw key/local source 404 fetches by using placeholder render fallbacks before hydration.

---

## [0.0.7]

### Fixed

- Fixed preloaded pipe tables parsing so they initialise as interactive editor tables (same behavior as toolbar-inserted tables).
- Fixed table alignment markers (`:---`, `:---:`, `---:`) so alignment renders correctly in-editor and round-trips to markdown.

---

## [0.0.6] - 2026-04-16

### Added

- Editable code badges for inline code modification
- Click-to-edit support for code blocks

### Changed

- Improved editing UX for code blocks

---

## [0.0.5] - 2026-04-15

### Added

- Added GFM table support with full editor ↔ markdown round-trip.

---

## [0.0.4] - 2026-04-14

### Added

- HTML support (`allowHtml`) enabling text alignment (left, centre, right).
- Inline image insertion at cursor position.
- Image queue system for managing local image previews.
  - (Can be uploaded to a CDN)

### Changed

- Replaced all toolbar icons with updated set.
- Unified image handling across drag-and-drop, paste, and toolbar insertion.
- Improved ProseMirror image node rendering with preview support.
- Refactored editor setup to support image queue + preview syncing.
- Improved markdown ↔ editor state synchronisation.

### Fixed

- Fixed cursor placement issues when inserting images.
- Fixed duplicate image insertion in mixed input flows.
- Fixed inline image reordering behaviour.
- Fixed inconsistencies between markdown output and rendered state.
- Fixed various toolbar state and command sync edge cases.

---

## [0.0.3] - 2025-11-04

### Fixed

- Improved image drag-and-drop behaviour.
- Fixed image reordering and insertion edge cases.

---

## [0.0.2] - 2025-11-03

### Added

- Initial image drop + paste support.
- Local image preview handling.

---

## [0.0.1] - Initial release

### Added

- Base markdown editor implementation.
