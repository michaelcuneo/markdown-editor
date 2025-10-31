<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { setupProseMirror } from './setupProseMirror.js';

  let { markdown = $bindable('') }: { markdown: string } = $props();
  let editorContainer: HTMLDivElement;
  let view: ReturnType<typeof setupProseMirror>;

  onMount(() => {
    view = setupProseMirror(editorContainer, markdown, (md) => (markdown = md));
  });

  onDestroy(() => {
    if (view) view.destroy();
  });
</script>

<div bind:this={editorContainer} class="prosemirror-editor"></div>

<style>
  .prosemirror-editor {
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 12px;
    min-height: 420px;
    padding: 1rem;
    cursor: text;
  }

  :global(.ProseMirror) {
    outline: none;
    white-space: pre-wrap;
  }

  :global(.ProseMirror p) {
    margin: 0 0 0.5em;
  }

  :global(.ProseMirror h1, .ProseMirror h2, .ProseMirror h3) {
    color: var(--accent);
    font-weight: 600;
  }

  :global(.ProseMirror code) {
    background: #1c1c1c;
    padding: 0.15rem 0.35rem;
    border-radius: 4px;
    color: #f7b955;
    font-family: monospace;
  }

  :global(.ProseMirror pre code) {
    display: block;
    background: #0f1012;
    padding: 0.75rem;
    border-radius: 8px;
  }

  :global(.ProseMirror a) {
    color: var(--accent);
    text-decoration: underline;
  }

  :global(.ProseMirror li[data-task-item]) {
    list-style: none;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  :global(.ProseMirror li[data-task-item] input[type='checkbox']) {
    cursor: pointer;
    accent-color: var(--accent);
  }
</style>
