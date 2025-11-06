<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { setupProseMirror } from './setupProseMirror.js';
	import { handleAction, setEditorView, getCommandState } from './controller/editorController.js';
	import type { EditorView } from 'prosemirror-view';
	import EditorToolbar from './EditorToolbar.svelte';
	import type { ToolbarAction } from '../types/index.js';
	import { autoSavePlugin } from './plugins/autoSavePlugin.js';
	import { syncImageLinesToQueue } from './utils/useImageSync.js';

  function debounce<T extends (...args: any[]) => void>(fn: T, delay = 250) {
	let timer: ReturnType<typeof setTimeout> | undefined;
    return (...args: Parameters<T>) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

	let {
		markdown = $bindable(''),
		toolbar = true,
		imageQueue = $bindable([]),
		clearDraft = $bindable(false),
		docId = 'default',
		editable = true
	}: {
		markdown: string;
		toolbar?: boolean;
		imageQueue?: { id: string; file: File; previewUrl?: string }[];
		clearDraft?: boolean | (() => void);
		docId?: string;
		editable?: boolean;
	} = $props();

	let editorRef: HTMLDivElement | null = $state(null);
	let editorView: EditorView | null = null;
	let initializing = true;
	let commandStates: Record<string, { enabled: boolean; reason?: string }> = $state({});
	let activeMarks = $state<Record<string, boolean>>({});
	let activeBlocks = $state<Record<string, boolean>>({});
	let lastAppliedDocId: string | null = null;

	// 🔁 Keep ProseMirror → Svelte synced
  const emitMarkdownUpdate = debounce((md: string) => {
    markdown = md;
  }, 150);

  function updateMarkdownFromEditor() {
    if (!editorView) return;
    const md = (editorView as any).getMarkdown?.() ?? markdown;
    if (md !== markdown) emitMarkdownUpdate(md);
  }

	// 🔁 Keep Svelte → ProseMirror synced (explicit only)
	function updateEditorFromMarkdown(md: string) {
		if (!editorView) return;
		(editorView as any).setMarkdown?.(md);
	}

	// 🧹 Clear saved draft when requested
	$effect(() => {
		if (!clearDraft) return;
		autoSavePlugin.clear('markdown-editor', docId);
		console.info(`🧹 Cleared saved draft for docId: ${docId}`);

		// Reset the flag (so consumer can trigger again later)
		if (typeof clearDraft === 'boolean') clearDraft = false;
	});

	// ✅ Keep preview map in sync with image queue
	$effect(() => {
		(window as any).__imagePreviewMap = Object.fromEntries(
			imageQueue.map(i => [i.id, i.previewUrl])
		);

		// Force ProseMirror refresh to reflect new image previews
		if (editorView?.state) {
			const tr = editorView.state.tr.setMeta('forceUpdate', true);
			editorView.updateState(editorView.state.apply(tr));
		}
	});

	// ✅ Keep markdown lines synced with image queue
	$effect(() => {
		markdown = syncImageLinesToQueue(markdown, imageQueue);
		updateEditorFromMarkdown(markdown);
	});

	// 🧭 Update toolbar button states
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
			task: getCommandState('task', state)
		};
	}

	// 🧩 Only reapply markdown when switching documents
	$effect(() => {
		if (!editorView || initializing) return;

		if (docId !== lastAppliedDocId) {
			console.log(`📄 Loading document ID: ${docId}`);
			(editorView as any).setMarkdown?.(markdown);
			lastAppliedDocId = docId;
		}
	});

	onMount(() => {
		if (!editorRef) return;
		editorRef.innerHTML = '';

		const savedContent = localStorage.getItem('markdown-editor-content-v1');
		const savedImages = localStorage.getItem('markdown-editor-images-v1');

		if (savedContent) markdown = savedContent;

		if (savedImages) {
			try {
				imageQueue = JSON.parse(savedImages);
			} catch {
				imageQueue = [];
			}
		}

		editorView = setupProseMirror(editorRef, markdown, imageQueue, docId, editable);
		setEditorView(editorView);

		if (markdown && markdown.trim().length > 0) {
			(editorView as any).setMarkdown?.(markdown);
		}

		editorView.setProps({
			editable: () => editable,
			dispatchTransaction(transaction) {
				if (!editorView) return;
				const newState = editorView.state.apply(transaction);
				editorView.updateState(newState);
				// updateMarkdownFromEditor();
				updateToolbarState();
			}
		});

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

<!-- ✅ Single root wrapper ensures hydration correctness -->
<section class="markdown-editor" data-svelte-nonreactive>
	{#if toolbar}
		<EditorToolbar
			onAction={onAction}
			{activeMarks}
			{activeBlocks}
			{commandStates}
		/>
	{/if}

	<!-- 👇 This must be totally isolated from reactivity -->
	<div bind:this={editorRef} class="ProseMirror"></div>
</section>
