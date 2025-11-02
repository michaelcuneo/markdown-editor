<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { setupProseMirror } from './setupProseMirror.js';
  import { handleAction, setEditorView, getCommandState } from './controller/editorController.js';
  import type { EditorView } from 'prosemirror-view';
  import EditorToolbar from './EditorToolbar.svelte';
  import type { ToolbarAction } from '$lib/types/index.js';

  let {
    markdown = $bindable(''),
    toolbar = true,
    editable = true
  }: {
    markdown: string;
    toolbar?: boolean
    editable?: boolean;
   } = $props();

  let editorRef: HTMLDivElement | null = $state(null);
  let editorView: EditorView | null = null;
  let initializing = true;
  let commandStates: Record<string, { enabled: boolean; reason?: string }> = $state({});
  let activeMarks = $state<Record<string, boolean>>({});
  let activeBlocks = $state<Record<string, boolean>>({});

  // 🔁 Keep ProseMirror -> Svelte synced
  function updateMarkdownFromEditor() {
    if (!editorView) return;
    const md =
      (editorView as any).getMarkdown?.() ??
      markdown;

    if (md !== markdown) markdown = md;
  }

  // 🔁 Keep Svelte -> ProseMirror synced
  function updateEditorFromMarkdown(md: string) {
    if (!editorView) return;
    (editorView as any).setMarkdown?.(md);
  }

  function updateToolbarState() {
    if (!editorView) return;

    const { state } = editorView;
    const { from, to } = state.selection;
    const selFrom = state.selection.$from;

    const marks = state.schema.marks;
    const nodes = state.schema.nodes;

    const active: Record<string, boolean> = {};
    for (const [name, mark] of Object.entries(marks)) {
      active[name === 'strong' ? 'bold' : name] = state.doc.rangeHasMark(from, to, mark);
    }
    activeMarks = active;

    const blockActive: Record<string, boolean> = {};
    const parent = selFrom.parent;
    if (parent?.type === nodes.heading) blockActive[`h${parent.attrs.level}`] = true;
    if (parent?.type === nodes.blockquote) blockActive.quote = true;
    if (parent?.type === nodes.bullet_list) blockActive.ul = true;
    if (parent?.type === nodes.ordered_list) blockActive.ol = true;
    if (parent?.attrs?.checked !== undefined) blockActive.task = true;
    activeBlocks = blockActive;

    // ✅ compute disabled state for each toolbar button
    commandStates = {
      bold: getCommandState('bold', state),
      italic: getCommandState('italic', state),
      strike: getCommandState('strike', state),
      h1: getCommandState('h1', state),
      h2: getCommandState('h2', state),
      quote: getCommandState('quote', state),
      ul: getCommandState('ul', state),
      ol: getCommandState('ol', state),
      codeblock: getCommandState('codeblock', state),
      undo: getCommandState('undo', state),
      redo: getCommandState('redo', state),
      link: getCommandState('link', state),
      task: getCommandState('task', state),
    };
  }

  // 🧠 Sync external markdown when props change (after init)
  $effect(() => {
    if (!editorView || initializing) return;
    updateEditorFromMarkdown(markdown);
  });

  onMount(() => {
    if (!editorRef) return;
    editorRef.innerHTML = '';
    editorView = setupProseMirror(editorRef);
    setEditorView(editorView);

    if (markdown && markdown.trim().length > 0) {
      (editorView as any).setMarkdown?.(markdown);
    }

    editorView.setProps({
      dispatchTransaction(transaction) {
        if (!editorView) return;
        const newState = editorView.state.apply(transaction);
        editorView.updateState(newState);
        updateMarkdownFromEditor();
        updateToolbarState();
      },
    });

    // 🧠 Listen for our custom toggle event
    editorRef.addEventListener('pm-updated', () => {
      updateMarkdownFromEditor();
      updateToolbarState();
    });

    initializing = false;
    updateToolbarState();
  });

  function onAction(action: ToolbarAction) {
    if (!editorView) return;
    handleAction(action);
    updateToolbarState();
  }

  onDestroy(() => {
    editorView?.destroy();
    setEditorView(null);
  });
</script>

<!-- Toolbar -->
{#if toolbar}
  <EditorToolbar onAction={onAction} {activeMarks} {activeBlocks} {commandStates} />
{/if}

<!-- Editable area -->
<div bind:this={editorRef} class="ProseMirror"></div>
