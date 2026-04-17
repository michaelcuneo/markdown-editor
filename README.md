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
- Two-way binding with `bind:value`
- Task lists with interactive checkboxes
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

| Prop              | Type               | Default     | Description                                             |
| ----------------- | ------------------ | ----------- | ------------------------------------------------------- |
| `initialMarkdown` | `string`           | `undefined` | Initial markdown content used when creating the editor. |
| `imageQueue`      | `ImageQueueItem[]` | `undefined` | Initial queue of images available to the editor.        |
| `docId`           | `string`           | `undefined` | Identifier used to distinguish or reset editor state.   |
| `editable`        | `boolean`          | `true`      | Controls whether the editor is editable.                |
| `allowHtml`       | `boolean`          | `false`     | Enables or disables HTML parsing in the editor.         |

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
