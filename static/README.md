# @michaelcuneo/markdown-editor

A modern **WYSIWYM Markdown editor for Svelte 5**, built with **ProseMirror** and **CodeMirror 6**.

It supports live Markdown editing, task lists, fenced code blocks with syntax highlighting, keyboard shortcuts, and a fully themeable light/dark design system powered by CSS variables.

---

## Live Demo

**Demo:** https://markdown-editor.michaelcuneo.com.au

Try headings, inline formatting, code fences, lists, and interactive task items rendered live as you type.

Built with **Svelte 5**, **TypeScript**, **ProseMirror**, and **CodeMirror 6**.

---

## Features

- WYSIWYM Markdown editing
- Fast WYSIWYG ↔ Markdown source switching
- Two-way binding with `bind:value`
- Task lists with interactive checkboxes
- Image manipulation tools (replace, remove, caption, drag, resize)
- Optional responsive image optimization controls
- Fenced code blocks with CodeMirror 6
- Syntax highlighting
- Keyboard shortcuts
- Read-only and runtime editable modes
- Per-document reset support with `docId`
- Fully themeable via CSS custom properties
- Optional HTML sanitization with DOMPurify
- Works in SSR and SPA environments

---

## Installation

Install the package plus its peer dependencies:

```bash
npm install @michaelcuneo/markdown-editor \
  prosemirror-state \
  prosemirror-view \
  prosemirror-model \
  prosemirror-commands \
  prosemirror-markdown \
  prosemirror-history \
  prosemirror-keymap \
  prosemirror-inputrules \
  prosemirror-schema-list \
  codemirror \
  @codemirror/state \
  @codemirror/view \
  @codemirror/language \
  @codemirror/theme-one-dark \
  @codemirror/lang-javascript \
  @codemirror/lang-markdown \
  @codemirror/lang-python
```

If you use pnpm:

```bash
pnpm add @michaelcuneo/markdown-editor \
  prosemirror-state \
  prosemirror-view \
  prosemirror-model \
  prosemirror-commands \
  prosemirror-markdown \
  prosemirror-history \
  prosemirror-keymap \
  prosemirror-inputrules \
  prosemirror-schema-list \
  codemirror \
  @codemirror/state \
  @codemirror/view \
  @codemirror/language \
  @codemirror/theme-one-dark \
  @codemirror/lang-javascript \
  @codemirror/lang-markdown \
  @codemirror/lang-python
```

These are peer dependencies so your app can control versions and avoid conflicts.

---

## Basic Usage

```svelte
<script lang="ts">
	import { SvelteMarkdownEditor } from '@michaelcuneo/markdown-editor';
	import '@michaelcuneo/markdown-editor/styles.css';

	let content = `# Welcome

This is a **Markdown editor** built with Svelte 5.

- [x] Task lists
- [ ] Live preview
- [ ] Syntax highlighting

\`\`\`ts
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`
`;
</script>

<SvelteMarkdownEditor bind:value={content} />
```

---

## Two-Way Binding

The editor is reactive by design.

```svelte
<script lang="ts">
	import { SvelteMarkdownEditor } from '@michaelcuneo/markdown-editor';

	let value = '# Hello';
</script>

<SvelteMarkdownEditor bind:value />

<p>Characters: {value.length}</p>
```

---

## Props

| Prop              | Type                            | Default     | Description                                                        |
| ----------------- | ------------------------------- | ----------- | ------------------------------------------------------------------ |
| `initialMarkdown` | `string`                        | `undefined` | Initial markdown content used when creating the editor.            |
| `imageQueue`      | `Record<string, MarkdownImage>` | `undefined` | Image queue map exposed for full consumer control.                 |
| `imageOptions`    | `MarkdownImageOptions`          | `{}`        | Optional image manipulation + optimization behavior configuration. |
| `viewMode`        | `'wysiwyg' \| 'markdown'`       | `'wysiwyg'` | Controls whether the editor opens in visual or raw markdown mode.  |
| `docId`           | `string`                        | `undefined` | Identifier used to distinguish or reset editor state.              |
| `editable`        | `boolean`                       | `true`      | Controls whether the editor is editable.                           |
| `allowHtml`       | `boolean`                       | `false`     | Enables or disables HTML parsing in the editor.                    |

### View modes

- `Markdown` mode shows a raw markdown source textarea for direct editing.

### `imageOptions` (optional)

The editor stays neutral by default: images are added to `imageQueue` and previewed locally.
This README focuses on built-in image manipulation + optimization behavior.

| Key                  | Type                                 | Default                                    | Description                                                          |
| -------------------- | ------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------- |
| `enableOptimization` | `boolean`                            | `false`                                    | Enables Sharpless-based optimization controls in image UI.           |
| `optimizeOnDrop`     | `boolean`                            | `true`                                     | If optimization is enabled, auto-optimizes dropped/pasted images.    |
| `quality`            | `number`                             | `0.82`                                     | Default optimization quality target.                                 |
| `formats`            | `string[]`                           | `['image/webp','image/jpeg','image/avif']` | Output formats requested from optimizer.                             |
| `targets`            | `{ width: number; label: string }[]` | Built-in responsive targets                | Output widths/labels for responsive variants and generated `srcSet`. |
| `preferredFormat`    | `string`                             | `'image/webp'`                             | Preferred format for preview + responsive source selection.          |

### Image manipulation behavior

- Inline caption editing (`alt` text)
- Replace image from local file picker
- Remove image node from document
- Drag-to-reorder image blocks
- Corner resize handles with persisted dimensions
- Optional optimization panel (`quality`, `widths`, `format`) with Apply action

### Example: keep everything local (no uploads)

```svelte
<script lang="ts">
	import { SvelteMarkdownEditor } from '@michaelcuneo/markdown-editor';

	let value = '# Hello';
	let imageQueue = {};
</script>

<SvelteMarkdownEditor
	bind:value
	{imageQueue}
	imageOptions={{
		enableOptimization: true,
		storage: 'local',
		optimizeOnDrop: false
	}}
/>
```

### Save contract (consumer-owned)

On Save, host applications decide what to do with `imageQueue` and generated variants.
Typical flows include persisting markdown as-is, replacing refs, uploading files, or discarding transient queue state.

---

## Examples

### Reset on document change

```svelte
<script lang="ts">
	import { SvelteMarkdownEditor } from '@michaelcuneo/markdown-editor';

	let docId = 'intro';
	let value = '# Welcome';

	function loadNewDoc() {
		docId = 'notes';
		value = '## Empty new document';
	}
</script>

<button onclick={loadNewDoc}>New Document</button>

<SvelteMarkdownEditor bind:value {docId} />
```

---

### Toggle edit mode

```svelte
<script lang="ts">
	import { SvelteMarkdownEditor } from '@michaelcuneo/markdown-editor';

	let value = '# Hello';
	let editable = true;
</script>

<button onclick={() => (editable = !editable)}>
	{editable ? 'Lock Editing' : 'Enable Editing'}
</button>

<SvelteMarkdownEditor bind:value readonly={!editable} {editable} />
```

---

### Start in Markdown source mode

```svelte
<script lang="ts">
	import { SvelteMarkdownEditor } from '@michaelcuneo/markdown-editor';

	let value = '# Hello';
	let viewMode: 'wysiwyg' | 'markdown' = 'markdown';
</script>

<SvelteMarkdownEditor bind:value bind:viewMode />
```

---

## Toolbar & Shortcuts

| Action      | Shortcut                 |
| ----------- | ------------------------ |
| Bold        | Ctrl/Cmd + B             |
| Italic      | Ctrl/Cmd + I             |
| Headings    | Toolbar or # syntax      |
| Blockquote  | > then space             |
| Lists       | -, \*, 1. then space     |
| Task item   | - [ ] or - [x]           |
| Code block  | ``` + language + Enter   |
| Link        | Ctrl/Cmd + K             |
| View mode   | Ctrl/Cmd + Shift + M     |
| Undo / Redo | Ctrl/Cmd + Z / Shift + Z |

---

## Markdown Support

- Headings
- Bold, italic, strikethrough
- Inline code and fenced code blocks
- Blockquotes
- Lists and task lists
- Tables (GFM)
- Links
- Horizontal rules
- Syntax-highlighted code blocks

---

## Styling & Theming

Uses CSS custom properties under the `--md-*` namespace.

### Global theme

```css
:root {
	--md-bg: #fdfdfd;
	--md-fg: #222;
	--md-accent: #0b57d0;
	--md-code-bg: #f9fafb;
	--md-code-fg: #0056b3;
}
```

### Per-instance theme

```svelte
<div class="markdown-theme-ocean">
	<SvelteMarkdownEditor bind:value />
</div>
```

```css
.markdown-theme-ocean {
	--md-bg: #001a26;
	--md-fg: #cde9ff;
	--md-accent: #00b7ff;
	--md-code-bg: #011e2a;
	--md-selection-bg: #00384d;
}
```

### Styles

```ts
import '@michaelcuneo/markdown-editor/styles.css';
```

---

## CodeMirror Integration

- Uses One Dark-style theme in dark mode
- GitHub-style palette in light mode
- Fully overrideable via your own theme configuration

---

## Architecture

| Layer          | Role                                      |
| -------------- | ----------------------------------------- |
| ProseMirror    | Document model, schema, commands, history |
| CodeMirror 6   | Fenced code block editor                  |
| Custom plugins | Task lists, sync, enhancements            |
| DOMPurify      | HTML sanitization                         |
| Svelte 5       | Reactive component layer                  |

---

## Compatibility

| Feature           | Status |
| ----------------- | ------ |
| Svelte 5          | ✅     |
| TypeScript        | ✅     |
| SSR + SPA         | ✅     |
| Light/Dark themes | ✅     |
| CSS variables     | ✅     |
| Task lists        | ✅     |
| CodeMirror blocks | ✅     |
| One Dark support  | ✅     |
| docId / editable  | ✅     |

---

## License

MIT © Michael Cuneo
