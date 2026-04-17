<script lang="ts">
  import SvelteMarkdownEditor from '$lib/editor/MarkdownEditor.svelte';

let content = $state(`# Welcome to the Markdown Editor!

This is a **fully featured WYSIWYM Markdown editor** built with [Svelte&nbsp;5](https://svelte.dev) ✨  
It supports _rich formatting_, **live preview**, \`inline code\`, and even syntax-highlighted code blocks.

---

## Typography & Formatting

You can use **bold**, _italic_, **_both_**, or \`inline code\`.  
Links like [OpenAI](https://openai.com) are automatically styled and clickable.  

> "Markdown is not about syntax — it's about expression."  
> — _Anonymous Developer_

---

## Code Blocks with Syntax Highlighting

\`\`\`ts
// TypeScript Example
interface User {
  id: number;
  name: string;
  isAdmin?: boolean;
}

function greet(user: User): string {
  return user.isAdmin
    ? \`Welcome, Admin \${user.name}!\`
    : \`Hello, \${user.name}!\`;
}

console.log(greet({ id: 1, name: "Michael", isAdmin: true }));
\`\`\`

---

## Tables

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Bold / Italic | ✅ Done | Inline formatting supported |
| Code Blocks | ✅ Done | Syntax highlighting enabled |
| Task Lists | ✅ Done | Interactive markdown support |
| Tables | ✅ Done | GitHub Flavored Markdown |
| Image Uploads | 🚧 In Progress | Toolbar and paste/drop support |

### Alignment Demo

| Left | Center | Right |
| :--- | :----: | ----: |
| Text | Text | Text |
| Apple | Banana | 12 |
| Svelte | Markdown | 99 |

---

## Task Lists

- [x] Build Markdown Schema
- [x] Add WYSIWYM Formatting
- [ ] Implement Image Uploads
- [ ] Add Slash Command Menu (\`/\`)
- [ ] Polish Dark & Light Theme

---

## Lists & Nesting

- Features:
  - Toolbar Formatting
  - Live Preview
  - Task Lists
  - Syntax Highlighting
- Supported:
  1. Ordered Lists
  2. Nested Lists
     1. Like this
     2. And this
  3. Works Great!

---

## Blockquotes & Rules

> "The best way to predict the future is to implement it."  
> — Alan Kay

---

## Try It Out

Type some Markdown below to see real-time updates.  
Experiment with:
- Pressing **Ctrl+B** or **Ctrl+I**
- Inserting \`code blocks\`
- Creating [links](https://example.com)
- Building tables with pipes and alignment markers
- Using the toolbar for formatting

---

That's it! You're editing with a fully interactive Markdown editor built with ❤️ and Svelte.
`);

  let imageQueue = $state<{ id: string; file: File; previewUrl?: string }[]>([]);
</script>

<svelte:head>
  <title>Markdown Editor Demo</title>
  <meta name="description" content="Demo page for the Markdown Editor Svelte component." />
</svelte:head>

<div class="main">
  <section class="demo-section">
    <h1>Markdown Editor Demo</h1>
    <p>
      This demo showcases the <code>@michaelcuneo/markdown-editor</code> component.
      Edit Markdown in the left pane and see live preview updates on the right.
    </p>

  <SvelteMarkdownEditor bind:markdown={content} toolbar={true} editable={true} imageQueue={imageQueue} allowHtml={true} />
  </section>
</div>

<style>
  .main {
    max-width: 1200px;
    margin: 4rem auto;
    padding: 2rem;
  }

  h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  p {
    color: var(--color-text-muted);
    line-height: 1.6;
  }

  .demo-section {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 2rem;
  }

  code {
    background: var(--color-border);
    padding: 0.15rem 0.35rem;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  @media (max-width: 700px) {
    .main {
      padding: 1rem;
    }

    .demo-section {
      padding: 1.25rem;
    }
  }
</style>
