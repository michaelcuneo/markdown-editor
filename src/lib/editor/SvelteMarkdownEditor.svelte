<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { setupProseMirror } from './setupProseMirror.js';
  import { handleAction, setEditorView, getCommandState } from './controller/editorController.js';
  import type { EditorView } from 'prosemirror-view';
  import EditorToolbar from './EditorToolbar.svelte';
  import type { ToolbarAction } from '$lib/types/index.js';

  let { markdown = $bindable('') }: { markdown: string } = $props();

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
<EditorToolbar onAction={onAction} {activeMarks} {activeBlocks} {commandStates} />

<!-- Editable area -->
<div bind:this={editorRef} class="ProseMirror"></div>

<style>
  @media (prefers-color-scheme: light) {
		:global(.ProseMirror) {
			background: #ffffff;
			color: #1a1b1e;
			font-family: 'Inter', system-ui, sans-serif;
			font-size: 15px;
			line-height: 1.6;
			padding: 1rem;
			border-radius: 8px;
			border: 1px solid #e0e0e0;
			box-shadow: inset 0 0 0 1px #f3f3f3;
			min-height: 240px;
			transition:
				background 0.2s ease,
				border-color 0.2s ease;
		}
		:global(.ProseMirror:focus) {
			outline: none;
			border-color: #4f83ff;
			box-shadow: 0 0 0 1px #4f83ff33;
		}
		:global(.ProseMirror p) {
			margin: 0.4em 0;
		}
		:global(.ProseMirror ul),
		:global(.ProseMirror ol) {
			margin-left: 1.5em;
		}
		:global(.ProseMirror li) {
			margin: 0.25em 0;
		}
		:global(.ProseMirror h1),
		:global(.ProseMirror h2),
		:global(.ProseMirror h3) {
			color: #1a1b1e;
			font-weight: 600;
			line-height: 1.3;
			margin: 0.8em 0 0.4em;
		}
		:global(.ProseMirror h1) {
			font-size: 1.6rem;
			border-bottom: 1px solid #e8e8e8;
			padding-bottom: 0.3rem;
		}
		:global(.ProseMirror h2) {
			font-size: 1.3rem;
			color: #333;
		}
		:global(.ProseMirror h3) {
			font-size: 1.15rem;
			color: #444;
		}
		:global(.ProseMirror strong) {
			color: #000;
			font-weight: 600;
		}
		:global(.ProseMirror em) {
			color: #d28b00;
			font-style: italic;
		}
		:global(.ProseMirror code) {
			font-family: 'JetBrains Mono', monospace;
			background: #f5f5f5;
			color: #0056b3;
			border-radius: 4px;
			padding: 0.1em 0.3em;
		}
		:global(.ProseMirror blockquote) {
			border-left: 3px solid #4f83ff;
			color: #4d4d4d;
			background: #f7f9ff;
			padding-left: 1rem;
			margin: 0.8em 0;
			font-style: italic;
		}
		:global(.ProseMirror li::marker) {
			color: #4f83ff;
		}
		:global(.ProseMirror a) {
			color: #0056b3;
			text-decoration: underline;
		}
		:global(.ProseMirror a:hover) {
			color: #1a73e8;
		}
		:global(.ProseMirror ::selection) {
			background: #cce0ff;
		}

		/* === Task List Styling === */
		:global(.ProseMirror li[data-checked]) {
			list-style: none;
			position: relative;
			margin: 0.25em 0 0.25em 0.2em;
			padding-left: 1.8em;
			min-height: 1.4em;
		}
		:global(.ProseMirror .pm-task) {
			display: flex;
			align-items: flex-start;
			gap: 0.5rem;
			line-height: 1.5;
			color: #1a1b1e;
		}
		:global(.ProseMirror .pm-task-checkbox) {
			position: absolute;
			left: 0;
			top: 0.25em;
			width: 1em;
			height: 1em;
			cursor: pointer;
			accent-color: #4f83ff;
			background-color: #ffffff;
			border: 1px solid #bdbdbd;
			border-radius: 4px;
			transform: scale(1.05);
			transition:
				background-color 0.15s ease,
				border-color 0.15s ease,
				box-shadow 0.15s ease;
		}
		:global(.ProseMirror li[data-checked='true'] .pm-task-checkbox) {
			background-color: #4f83ff;
			border-color: #4f83ff;
			box-shadow: 0 0 0 1px #4f83ff33;
		}
		:global(.ProseMirror .pm-task-checkbox:hover) {
			border-color: #4f83ff;
			box-shadow: 0 0 0 1px #4f83ff33;
		}
		:global(.ProseMirror .pm-task-content) {
			display: inline-block;
			vertical-align: top;
			color: #1a1b1e;
		}
		:global(.ProseMirror li[data-checked='true'] .pm-task-content) {
			text-decoration: line-through;
			color: #999;
		}
		:global(.ProseMirror ul),
		:global(.ProseMirror ol) {
			margin-left: 1.4em;
			padding-left: 0.2em;
		}
		:global(.ProseMirror li) {
			margin: 0.25em 0;
		}
		:global(.ProseMirror ul > li[data-checked]),
		:global(.ProseMirror ol > li[data-checked]) {
			margin-left: 0.1em;
		}
		:global(.ProseMirror .pm-task-checkbox) {
			transition:
				background-color 0.15s ease,
				border-color 0.15s ease,
				box-shadow 0.15s ease,
				transform 0.1s ease;
		}
		:global(.ProseMirror .pm-task-checkbox:active) {
			transform: scale(0.95);
		}
    :global(.ProseMirror hr) {
      border: none;
      border-top: 1px solid #3a3c40;
      margin: 1em 0;
      opacity: 0.6;
    }
    /* === Link Styling (WYSIWYM Markdown) === */
:global(.ProseMirror a.pm-link) {
  color: #4f83ff;
  text-decoration: underline;
  cursor: pointer !important;
  transition: color 0.15s ease, background-color 0.15s ease;
}

:global(.ProseMirror a.pm-link:hover) {
  color: #82aaff;
  background: rgba(79, 131, 255, 0.08);
}

/* Tooltip always-on hover style */
:global(.pm-link-tooltip) {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  user-select: none;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.3;
  border-radius: 6px;
  background: rgba(30, 32, 40, 0.95);
  color: #fff;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

:global(.pm-link-tooltip.show) {
  opacity: 1;
  transform: translateY(0);
}

  }
  @media (prefers-color-scheme: dark) {
    :global(.ProseMirror) {
      background: #1a1b1e;
      color: #e8eaed;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 15px;
      line-height: 1.6;
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid #2c2d30;
      box-shadow: inset 0 0 0 1px #2a2b2f;
      min-height: 240px;
      transition:
        background 0.2s ease,
        border-color 0.2s ease;
    }
    :global(.ProseMirror:focus) {
      outline: none;
      border-color: #4f83ff;
      box-shadow: 0 0 0 1px #4f83ff;
    }
    :global(.ProseMirror p) {
      margin: 0.4em 0;
    }
    :global(.ProseMirror ul),
    :global(.ProseMirror ol) {
      margin-left: 1.5em;
    }
    :global(.ProseMirror li) {
      margin: 0.2em 0;
    }
    :global(.ProseMirror h1),
    :global(.ProseMirror h2),
    :global(.ProseMirror h3) {
      color: #fafafa;
      font-weight: 600;
      line-height: 1.3;
      margin: 0.8em 0 0.4em;
    }
    :global(.ProseMirror h1) {
      font-size: 1.6rem;
      border-bottom: 1px solid #2e2f33;
      padding-bottom: 0.3rem;
    }
    :global(.ProseMirror h2) {
      font-size: 1.3rem;
      color: #e0e0e0;
    }
    :global(.ProseMirror h3) {
      font-size: 1.15rem;
      color: #cfd2d8;
    }
    :global(.ProseMirror strong) {
      color: #fff;
      font-weight: 600;
    }
    :global(.ProseMirror em) {
      color: #f0c674;
      font-style: italic;
    }
    :global(.ProseMirror code) {
      font-family: 'JetBrains Mono', monospace;
      background: #2d2f33;
      color: #8ab4f8;
      border-radius: 4px;
      padding: 0.1em 0.3em;
    }
    :global(.ProseMirror blockquote) {
      border-left: 3px solid #4f83ff;
      color: #9aa0a6;
      padding-left: 1rem;
      margin: 0.8em 0;
      font-style: italic;
    }
    :global(.ProseMirror li::marker) {
      color: #8ab4f8;
    }
    :global(.ProseMirror a) {
      color: #8ab4f8;
      text-decoration: underline;
    }
    :global(.ProseMirror a:hover) {
      color: #aecbfa;
    }
    :global(.ProseMirror ::selection) {
      background: #3b4b6d;
    }

    /* === Task List Styling === */
    :global(.ProseMirror li[data-checked]) {
      list-style: none;
      position: relative;
      margin: 0.25em 0 0.25em 0.2em;
      padding-left: 1.8em;
      min-height: 1.4em;
    }
    :global(.ProseMirror .pm-task) {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      line-height: 1.5;
      color: #e8eaed;
    }
    :global(.ProseMirror .pm-task-checkbox) {
      position: absolute;
      left: 0;
      top: 0.25em;
      width: 1em;
      height: 1em;
      cursor: pointer;
      accent-color: #4f83ff;
      background-color: #1f2023;
      border: 1px solid #3b3d42;
      border-radius: 4px;
      transform: scale(1.05);
      transition:
        background-color 0.15s ease,
        border-color 0.15s ease,
        box-shadow 0.15s ease;
    }
    :global(.ProseMirror li[data-checked='true'] .pm-task-checkbox) {
      background-color: #4f83ff;
      border-color: #4f83ff;
      box-shadow: 0 0 0 1px #4f83ff44;
    }
    :global(.ProseMirror .pm-task-checkbox:hover) {
      border-color: #5b5d62;
      box-shadow: 0 0 0 1px #4f83ff33;
    }
    :global(.ProseMirror .pm-task-content) {
      display: inline-block;
      vertical-align: top;
      color: #e8eaed;
    }
    :global(.ProseMirror li[data-checked='true'] .pm-task-content) {
      text-decoration: line-through;
      color: #9aa0a6;
    }
    :global(.ProseMirror ul),
    :global(.ProseMirror ol) {
      margin-left: 1.4em;
      padding-left: 0.2em;
    }
    :global(.ProseMirror li) {
      margin: 0.25em 0;
    }
    :global(.ProseMirror ul > li[data-checked]),
    :global(.ProseMirror ol > li[data-checked]) {
      margin-left: 0.1em;
    }
    :global(.ProseMirror .pm-task-checkbox) {
      transition:
        background-color 0.15s ease,
        border-color 0.15s ease,
        box-shadow 0.15s ease,
        transform 0.1s ease;
    }
    :global(.ProseMirror .pm-task-checkbox:active) {
      transform: scale(0.95);
    }
    :global(.ProseMirror hr) {
      border-top: 1px solid #ccc;
      opacity: 0.7;
    }
  }
</style>
