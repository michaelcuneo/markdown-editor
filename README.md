# 🪶 @michaelcuneo/markdown-editor

> **A modern WYSIWYM Markdown editor for [Svelte 5](https://svelte.dev)**  
> Powered by **ProseMirror** and **CodeMirror 6**, featuring task lists, fenced code blocks,  
> keyboard shortcuts, and a **fully themeable light/dark system** built with CSS variables.

---

## 🌐 Live Demo

🔗 https://markdown-editor.michaelcuneo.com.au

See headings, inline formatting, fenced code blocks with syntax highlighting,  
lists, and interactive task items — all rendered live as you type.

> Built with **Svelte 5 (runes)**, **ProseMirror**, **CodeMirror 6**, and **TypeScript**.

---

## 🚀 Installation

### 🧩 One-line install (recommended)

Install the editor and **all required peer dependencies** at once.

#### **pnpm**

```bash
npm i @michaelcuneo/markdown-editor \
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

These are declared as peerDependencies, so they’re not auto-installed.
This prevents version conflicts and allows your app to manage its own ProseMirror / CodeMirror versions.

---

## ⚙️ Basic Usage

```ts
<script lang="ts">
	import { SvelteMarkdownEditor } from '@michaelcuneo/markdown-editor';
	import '@michaelcuneo/markdown-editor/styles.css';

	let content = `# Welcome to the Markdown Editor!

This is a **fully featured Markdown editor** built with Svelte 5.
[OpenAI](https://openai.com) is great!

\`\`\`ts
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

- [x] Task Lists
- [ ] Live Preview
- [ ] Syntax Highlighting
`;
</script>

<SvelteMarkdownEditor bind:value={content} />
```

---

## 🧠 Two-Way Binding

Reactive by design — content updates instantly through `bind:value`.

```svelte
<p>Characters: {value.length}</p>
```

---

## 🧩 Props

| Prop            | Type                              | Default     | Description                                                                                   |
| --------------- | --------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `value`         | `string`                          | `''`        | The markdown content (bindable).                                                              |
| `readonly`      | `boolean`                         | `false`     | Enables read-only viewer mode (no toolbar, static content).                                   |
| `editable`      | `boolean`                         | `true`      | Toggles whether the editor is editable at runtime — useful for view-only states.              |
| `docId`         | `string`                          | `undefined` | Unique document ID — changing it clears and reloads content (useful for switching documents). |
| `sanitizeHtml`  | `boolean`                         | `true`      | Sanitizes exported HTML using DOMPurify.                                                      |
| `onUpdate`      | `(value: string) => void`         | —           | Fired whenever content changes.                                                               |
| `onImageUpload` | `(file: File) => Promise<string>` | —           | Optional async image upload hook — return a hosted URL.                                       |

---

### 💡 `docId` example — clear content on change

```ts
<script lang="ts">
	import { SvelteMarkdownEditor } from '@michaelcuneo/markdown-editor';

	let docId = 'intro';
	let value = '# Welcome!';

	function loadNewDoc() {
		docId = 'notes';
		value = '## Empty new document';
	}
</script>

<button onclick={loadNewDoc}>New Document</button>

<SvelteMarkdownEditor bind:value {docId} />
```

> Changing the `docId` resets the editor instance — great for multi-document editors or dashboard UIs.

---

### 🔒 `editable` example — toggle live edit mode

```ts
<script lang="ts">
	import { SvelteMarkdownEditor } from '@michaelcuneo/markdown-editor';

	let editable = true;
</script>

<button onclick={() => (editable = !editable)}>
	{editable ? 'Lock Editing' : 'Enable Editing'}
</button>

<SvelteMarkdownEditor bind:value readonly={!editable} {editable} />
```

> You can use `editable={false}` to switch to a live preview mode without tearing down the editor.

---

## 🎨 Toolbar & Shortcuts

| Action      | Shortcut                               |
| ----------- | -------------------------------------- |
| **Bold**    | `Ctrl/Cmd + B`                         |
| _Italic_    | `Ctrl/Cmd + I`                         |
| Headings    | Toolbar or `#`, `##`, `###`            |
| Blockquote  | `>` then space                         |
| Lists       | `-`, `*`, `1.` then space              |
| Task item   | `- [ ]` or `- [x]`                     |
| Code block  | ````` + language + Enter               |
| Link        | `Ctrl/Cmd + K`                         |
| Undo / Redo | `Ctrl/Cmd + Z`, `Ctrl/Cmd + Shift + Z` |

> 💡 Tip: Type `````ts` and press Enter to open an inline CodeMirror editor  
> with syntax highlighting and language label.

---

## 💡 Markdown Features

- Headings (`#`, `##`, `###`)
- Bold / Italic / Strikethrough
- Inline code and fenced blocks
- Blockquotes
- Lists and task lists
- Links and horizontal rules
- CodeMirror fenced code blocks with syntax highlighting

---

## 🧱 Styling & Theming

### 🪶 Built-in Theme System

The editor’s entire UI runs on **CSS custom properties** using the `--md-*` namespace.  
Light and dark modes are handled automatically with `prefers-color-scheme`,  
and every color is user-overridable for branding or theming.

Example overrides:

```css
:root {
	--md-bg: #fdfdfd;
	--md-fg: #222;
	--md-accent: #0b57d0;
	--md-code-bg: #f9fafb;
	--md-code-fg: #0056b3;
}
```

To theme per instance:

```html
<div class="markdown-theme-ocean">
	<SvelteMarkdownEditor />
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

---

### 🌑 CodeMirror 6 — True One Dark Integration

- The built-in **One Dark** palette is used automatically in dark mode.
- Full syntax colors from CodeMirror’s official theme (`#282c34`, `#c678dd`, `#61afef`, `#98c379`, etc.).
- Light mode uses a GitHub-inspired palette driven by your `--md-*` variables.
- You can override or extend the CodeMirror theme via  
  `src/lib/editor/theme/codeMirrorTheme.ts`.

---

### 🧩 Included Style Coverage

- Toolbar layout & actions
- Task lists & checkboxes
- CodeMirror fenced code blocks
- ProseMirror document base
- Light/dark theme support
- CSS variable token system

To use defaults:

```ts
import '@michaelcuneo/markdown-editor/styles.css';
```

Or override via CSS variables to match your design system.

---

## 🧩 Architecture Overview

| Layer                | Description                                           |
| -------------------- | ----------------------------------------------------- |
| **ProseMirror**      | Core document model, schema, input rules, and history |
| **CodeMirror 6**     | Inline fenced code block editor                       |
| **Custom Plugins**   | Handle task lists, fenced blocks, and synchronization |
| **DOMPurify**        | Optional HTML sanitization                            |
| **Svelte 5 (runes)** | Reactive shell, SSR-ready, fully bindable props       |

---

## ✅ Compatibility

| Feature                    | Status |
| -------------------------- | ------ |
| Svelte 5 (runes)           | ✅     |
| TypeScript                 | ✅     |
| SSR + SPA                  | ✅     |
| Light/Dark themes          | ✅     |
| CSS variables (`--md-*`)   | ✅     |
| User theme overrides       | ✅     |
| Task lists                 | ✅     |
| CodeMirror fenced blocks   | ✅     |
| True One Dark support      | ✅     |
| `docId` + `editable` props | ✅     |

---

## 🧾 License

MIT © Michael Cuneo (2025)

---

### TL;DR

`@michaelcuneo/markdown-editor` — **type, edit, and preview Markdown with zero fuss.**  
Now featuring full theming via CSS variables, CodeMirror One Dark integration,  
and runtime control via `docId` and `editable` props for multi-document and readonly workflows.
