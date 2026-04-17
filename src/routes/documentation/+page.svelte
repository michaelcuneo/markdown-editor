<script lang="ts">
  import SvelteMarkdownEditor from '$lib/editor/MarkdownEditor.svelte';
  import { onMount } from 'svelte';

  let readmeHtml = $state<string>('');
  let readmeDocId = $state('readme-empty');

  onMount(async () => {
    try {
      const res = await fetch('/README.md');
      if (!res.ok) throw new Error(`Failed to fetch README.md: ${res.statusText}`);
      readmeHtml = await res.text();
      readmeDocId = 'readme-loaded';
    } catch (err) {
      console.error('❌ Failed to load README:', err);
      readmeHtml = '# Documentation could not be loaded.';
      readmeDocId = 'readme-error';
    }
  });
</script>

<div class="main">
<section class="docs-section">
  <SvelteMarkdownEditor bind:markdown={readmeHtml} docId={readmeDocId} toolbar={false} editable={false} imageQueue={undefined} allowHtml={true} />
</section>
</div>

<style>
  .main {
    max-width: 1200px;
    margin: 4rem auto;
    padding: 2rem;
  }

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
</style>