<script lang="ts">
  import SvelteMarkdownEditor from '$lib/editor/MarkdownEditor.svelte';
  import { onMount } from 'svelte';

  let changelogHtml = $state<string>('');
  let changelogDocId = $state('changelog-empty');

  onMount(async () => {
    try {
      const res = await fetch('/CHANGELOG.md');
      if (!res.ok) throw new Error(`Failed to fetch CHANGELOG.md: ${res.statusText}`);
      changelogHtml = await res.text();
      changelogDocId = 'changelog-loaded';
    } catch (err) {
      console.error('❌ Failed to load CHANGELOG:', err);
      changelogHtml = '# Documentation could not be loaded.';
      changelogDocId = 'changelog-error';
    }
  });
</script>

<div class="main">
<section class="docs-section">
  <SvelteMarkdownEditor bind:markdown={changelogHtml} docId={changelogDocId} toolbar={false} editable={false} imageQueue={undefined} allowHtml={true} />
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