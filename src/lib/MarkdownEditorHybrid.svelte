<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import EditorToolbar from './EditorToolbar.svelte';
  import FileDialog from './FileDialog.svelte';
  import { setupProseMirror } from './editor/setupProseMirror.js';
  import { bindToolbarCommands } from './editor/commands.js';
  import { markdownSchema } from './editor/schema.js';
  import type { MarkdownEditorProps } from './types/index.js';

  let { value = $bindable(''), allowHtml = $bindable(false) }: MarkdownEditorProps = $props();
  let showImport = $state(false);
  let showExport = $state(false);

  let editorContainer: HTMLDivElement;
  let view: ReturnType<typeof setupProseMirror> | null = null;

  onMount(() => {
    // only create the editor once
    view = setupProseMirror(editorContainer, value, (markdown) => {
      // only update if it’s genuinely different text (and not immediately)
      if (markdown !== value) {
        value = markdown;
      }
    });
  });

  onDestroy(() => view?.destroy());

  function handleToolbarEvent(action: string) {
    if (!view) return;
    const cmds = bindToolbarCommands(view, markdownSchema);
    (cmds as any)[action]?.();
  }
</script>

<div class="editor-app">
  <EditorToolbar onAction={handleToolbarEvent} bind:allowHtml />
  <div bind:this={editorContainer} class="prosemirror-editor"></div>

  {#if showImport}
    <FileDialog type="import" onclose={() => (showImport = false)} />
  {/if}
  {#if showExport}
    <FileDialog type="export" onclose={() => (showExport = false)} />
  {/if}
</div>

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
  :global(.ProseMirror) { outline: none; white-space: pre-wrap; }
  :global(.ProseMirror p) { margin: 0 0 0.5em; }
  :global(.ProseMirror h1, .ProseMirror h2, .ProseMirror h3) { color: var(--accent); font-weight: 600; }
  :global(.ProseMirror code) { background: #1c1c1c; padding: 0.15rem 0.35rem; border-radius: 4px; color: #f7b955; font-family: monospace; }
  :global(.ProseMirror pre code) { display: block; background: #0f1012; padding: 0.75rem; border-radius: 8px; }
  :global(.ProseMirror a) { color: var(--accent); text-decoration: underline; }
</style>
