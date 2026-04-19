<script lang="ts">
  import SvelteMarkdownEditor from '$lib/editor/MarkdownEditor.svelte';
  import type { MarkdownImageOptions } from '$lib';

const DEFAULT_MARKDOWN_TEMPLATE = `# Welcome to the Markdown Editor!

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

## Preloaded Images from Markdown

The two images below are stored in markdown as S3 object keys and resolved to presigned URLs at runtime.

![Mountain Demo](demo-seeds/demo-seed-mountain/w1200-700.jpg)
![Ocean Demo](demo-seeds/demo-seed-ocean/w1200-700.jpg)

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
`;

let content = $state(DEFAULT_MARKDOWN_TEMPLATE);

  let docId = 'demo-preloaded-images-v5';
  let clearDraft = $state(false);

  const imageOptions: MarkdownImageOptions = {
    enableOptimization: true,
    optimizeOnDrop: true,
    storage: 'local',
    preferredFormat: 'image/jpeg',
    quality: 0.82,
    targets: [
      { width: 480, label: 'mobile' },
      { width: 900, label: 'tablet' },
      { width: 1400, label: 'desktop' }
    ],
    formats: ['image/jpeg', 'image/webp']
  };

  let imageQueue = $state<Record<string, { id: string; file?: File; previewUrl?: string; srcSet?: string; quality?: number }>>({});

  function resetDemoMarkdown(): void {
  content = DEFAULT_MARKDOWN_TEMPLATE;
    imageQueue = {};
    clearDraft = true;
  }

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
    <button type="button" class="reset-btn" onclick={resetDemoMarkdown}>Reset Demo Markdown</button>

  <SvelteMarkdownEditor bind:markdown={content} bind:clearDraft={clearDraft} {docId} toolbar={true} editable={true} imageQueue={imageQueue} {imageOptions} allowHtml={true} />
  </section>
</div>

<style>
  .main {
    max-width: 1200px;
    margin: 2.5rem auto;
    padding: 2rem;
  }

  .demo-section h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    line-height: 1.2;
  }

  .demo-section p {
    color: var(--color-text-muted);
    line-height: 1.6;
  }

  .reset-btn {
    margin-top: 0.5rem;
    margin-bottom: 0.9rem;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    border-radius: 8px;
    padding: 0.45rem 0.8rem;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }

  .demo-section {
    background: var(--color-surface);
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
      margin: 0;
      padding: 0.5rem;
    }

    .demo-section {
      padding: 0.625rem;
      border-radius: 12px;
    }

    .demo-section h1 {
      font-size: 1.35rem;
      margin-bottom: 0.375rem;
    }

    .demo-section p {
      font-size: 0.95rem;
      line-height: 1.45;
    }
  }

  @media (max-width: 430px) {
    .main {
      padding: 0.35rem;
    }

    .demo-section {
      padding: 0.5rem;
      border-radius: 10px;
    }

    .demo-section h1 {
      font-size: 1.2rem;
    }

    .demo-section p {
      font-size: 0.9rem;
    }
  }
</style>
