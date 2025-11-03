# 🪶 @michaelcuneo/svelte-markdown

> **A modern WYSIWYM Markdown editor for [Svelte 5](https://svelte.dev)**  
> Powered by ProseMirror and CodeMirror, featuring task lists, fenced code blocks,  
> keyboard shortcuts, and a responsive light/dark theme out of the box.

---

## 🌐 Live Demo

**See it in action:**  
🔗 https://svelte-markdown.michaelcuneo.com.au

The demo includes headings, inline formatting, fenced code blocks with syntax highlighting,  
lists, and interactive task items — all rendered live as you type.

> Built with **Svelte 5**, **ProseMirror**, **CodeMirror 6**, and **TypeScript**.

---

## 🚀 Installation

```bash
npm i @michaelcuneo/svelte-markdown
# or
pnpm add @michaelcuneo/svelte-markdown
# or
yarn add @michaelcuneo/svelte-markdown
```

---

## ⚙️ Basic Usage

```svelte
<script lang="ts">
	import { SvelteMarkdownEditor } from '@michaelcuneo/svelte-markdown';
	// Optional default styles (toolbar, dark/light theme, tasks, codemirror)
	import '@michaelcuneo/svelte-markdown/styles.css';

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

The editor is fully reactive — content updates instantly via `bind:value`.

```svelte
<p>Characters: {value.length}</p>
```

---

## 🧩 Props

**Available component props:**

- `value` → *string* — The markdown content (bindable).  
- `readonly` → *boolean* — Enables read-only viewer mode.  
- `sanitizeHtml` → *boolean* — Sanitizes exported HTML (via DOMPurify).  
- `onUpdate` → *(value: string) => void* — Fired when content changes.  
- `onImageUpload` → *(file: File) => Promise<string>* — Optional async image upload hook (return a URL).

---

## 🎨 Toolbar & Shortcuts

**Common actions and shortcuts:**

- **Bold:** `Ctrl/Cmd + B`
- *Italic:* `Ctrl/Cmd + I`
- ~~Strikethrough:~~ *(optional if schema enabled)*
- Headings: toggle H1/H2 from toolbar
- Blockquote: type `>` then space
- Unordered List: type `-`, `*`, or `+` then space
- Ordered List: type `1.` then space
- Task Item: `- [ ]` or `- [x]`
- Code Block: type ````` + lang + Enter
- Link: `Ctrl/Cmd + K`
- Undo / Redo: `Ctrl/Cmd + Z`, `Ctrl/Cmd + Shift + Z`

> Tip: Type `````ts` and press Enter to insert a TypeScript code block — a CodeMirror editor will appear inline with syntax highlighting and a language label.

---

## 💡 Markdown Features

This editor supports:

- Headings (`#`, `##`, `###`)
- Bold / Italic (`**text**`, `*text*`)
- Inline code (`` `code` ``)
- Blockquotes (`>`)
- Code blocks (`` ```lang ``)
- Lists (`-`, `1.`)
- Task lists (`- [ ]`, `- [x]`)
- Links (`[text](url)`)
- Horizontal rules (`---`)

---

## 🧱 Styling

A complete stylesheet is included covering:
- ProseMirror editor base styles  
- Toolbar layout  
- Task list checkboxes  
- CodeMirror blocks  
- Automatic light/dark theme

Import it directly:

```ts
import '@michaelcuneo/svelte-markdown/styles.css';
```

Prefer your own theme?  
Skip the import and override the CSS hooks:

```css
.ProseMirror {
	background: #fff;
	border-radius: 8px;
}
.toolbar button {
	color: #111;
}
.pm-task-checkbox {
	accent-color: #0b57d0;
}
.pm-codemirror-wrapper {
	border: 1px solid #e5e7eb;
}
```

---

## 🧩 Architecture Overview

**Core layers:**

- **ProseMirror:** document model, schema, input rules, and history.
- **CodeMirror 6:** embedded code editor for fenced blocks.
- **Highlight.js:** language syntax highlighting.
- **DOMPurify:** optional HTML sanitization.
- **Svelte 5:** reactive UI shell and bindings.

---

## 🧰 Development

```bash
git clone https://github.com/michaelcuneo/svelte-markdown.git
cd svelte-markdown
pnpm install
pnpm dev
```

Project structure:
- Demo page → `src/routes/demo/+page.svelte`
- Editor component → `src/lib/editor/SvelteMarkdownEditor.svelte`
- Plugins → `src/lib/editor/plugins/*`

---

## ✅ Compatibility

- Svelte 5 (runes) — ✅  
- TypeScript — ✅  
- SSR + SPA — ✅  
- Light/Dark theme — ✅  
- Task lists — ✅  
- CodeMirror fenced blocks — ✅  

---

## 🧾 License

MIT © Michael Cuneo (2025)

---

### TL;DR

`@michaelcuneo/svelte-markdown` — **type, edit, and preview Markdown with zero fuss.**  
Beautiful code blocks, interactive tasks, and WYSIWYM inline formatting for modern Svelte apps.
