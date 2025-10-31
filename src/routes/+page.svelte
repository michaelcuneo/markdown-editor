<script lang="ts">
  import MarkdownEditorHybrid from '$lib/MarkdownEditorHybrid.svelte';
  import { onMount } from 'svelte';

  let activeTab: 'editor' | 'docs' = $state('editor');
  let content = $state(`# Welcome to the Markdown Editor!

This is a **fully featured Markdown editor** built with Svelte 5.

- 🖋️ Toolbar formatting
- 🧩 Live preview (built-in)
- 🖼️ Drag & drop image support
- 💾 Import & export as Markdown or HTML
- 🔒 Optional HTML sanitization toggle

---

Try editing this text to see changes instantly in the preview!
`);
  let readmeHtml = $state<string>('');
  let imageQueue = $state<{ id: string; file: File; previewUrl?: string }[]>([]);

  onMount(async () => {
    try {
      const res = await fetch('/README.md');
      if (!res.ok) throw new Error(`Failed to fetch README.md: ${res.statusText}`);
      const content = await res.text();
      // We don’t parse it — the MarkdownEditor will handle that internally
      readmeHtml = content;
    } catch (err) {
      console.error('❌ Failed to load README:', err);
      readmeHtml = '# Documentation could not be loaded.';
    }
  });
</script>

<svelte:head>
  <title>Markdown Editor Demo</title>
  <meta name="description" content="Demo page for the Markdown Editor Svelte component." />
</svelte:head>

<main>
  <!-- Tabs -->
  <div class="tabs">
    <button class:active={activeTab === 'editor'} onclick={() => (activeTab = 'editor')}>
      Editor Demo
    </button>
    <button class:active={activeTab === 'docs'} onclick={() => (activeTab = 'docs')}>
      Documentation
    </button>
  </div>

  <!-- DEMO TAB -->
  {#if activeTab === 'editor'}
    <section class="demo-section">
      <h1>Markdown Editor Demo</h1>
      <p>
        This demo showcases the <code>@yourname/markdown-editor</code> component.
        Edit Markdown in the left pane and see live preview updates on the right.
      </p>

    <MarkdownEditorHybrid bind:value={content} />
    <pre>{content}</pre>
    </section>
  {:else}
    <section class="docs-section">
      <h1>📘 Documentation</h1>
      <p>The component documentation and usage guide from your package README:</p>
      <MarkdownEditorHybrid bind:value={readmeHtml} />
    </section>
  {/if}
</main>

<style>
  main {
    max-width: 1020px;
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

  /* ===== Tabs ===== */
  .tabs {
    display: flex;
    gap: 0.5rem;
    margin: 2rem 0 1.5rem;
  }

  .tabs button {
    flex: 1;
    padding: 0.75rem;
    font-weight: 600;
    border-radius: var(--radius);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    transition: all var(--transition);
  }

  .tabs button:hover {
    background: var(--color-accent-hover);
    color: #fff;
  }

  .tabs button.active {
    background: var(--color-accent);
    color: #fff;
    border-color: var(--color-accent-hover);
  }

  .demo-section,
  .docs-section {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 2rem;
  }

  .docs-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  code {
    background: var(--color-border);
    padding: 0.15rem 0.35rem;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  @media (max-width: 700px) {
    main {
      padding: 1rem;
    }

    .demo-section {
      padding: 1.25rem;
    }
  }
</style>
