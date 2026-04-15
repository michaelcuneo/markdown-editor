<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import type { EditorState } from 'prosemirror-state';
	import type { EditorView } from 'prosemirror-view';

	import EditorToolbar from './EditorToolbar.svelte';
	import type { ToolbarAction } from '../types/index.js';
	import { autoSavePlugin } from './plugins/autoSavePlugin.js';
	import { syncImageLinesToQueue } from './utils/useImageSync.js';

	type ImageQueueItem = {
		id: string;
		file?: File;
		name?: string;
		type?: string;
		size?: number;
		previewUrl?: string;
	};

	type CommandState = {
		enabled: boolean;
		reason?: string;
	};

	type ExtendedEditorView = EditorView & {
		getMarkdown?: () => string;
		setMarkdown?: (markdown: string) => void;
	};

	type EditorController = {
		handleAction: (action: ToolbarAction) => void;
		setEditorView: (view: EditorView | null) => void;
		setEditorOptions: (options: { allowHtml?: boolean }) => void;
		getCommandState: (
			action: ToolbarAction,
			state: EditorState
		) => CommandState;
	};

	type SetupProseMirror = (
		element: HTMLElement,
		initialMarkdown?: string,
		imageQueue?: ImageQueueItem[],
		docId?: string,
		editable?: boolean,
		allowHtml?: boolean
	) => ExtendedEditorView;

	function debounce<T extends (...args: never[]) => void>(fn: T, delay = 250) {
		let timer: ReturnType<typeof setTimeout> | undefined;

		return (...args: Parameters<T>) => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => fn(...args), delay);
		};
	}

	let {
		markdown = $bindable(''),
		toolbar = true,
		imageQueue = $bindable([] as ImageQueueItem[]),
		clearDraft = $bindable(false),
		docId = 'default',
		editable = true,
		allowHtml = false
	} = $props();

	let editorRef = $state<HTMLDivElement | null>(null);
	let editorView = $state<ExtendedEditorView | null>(null);
	let initializing = $state(true);
	let lastAppliedDocId = $state<string | null>(null);

	let commandStates = $state<Partial<Record<ToolbarAction, CommandState>>>({});
	let activeMarks = $state<Partial<Record<ToolbarAction, boolean>>>({});
	let activeBlocks = $state<Partial<Record<ToolbarAction, boolean>>>({});

	let removePmUpdatedListener = $state<(() => void) | null>(null);

	let handleAction = $state<(action: ToolbarAction) => void>(() => {});
	let setEditorView = $state<(view: EditorView | null) => void>(() => {});
	let setEditorOptions = $state<(options: { allowHtml?: boolean }) => void>(() => {});
	let getCommandState = $state<(action: ToolbarAction, state: EditorState) => CommandState>(
		() => ({ enabled: false })
	);

	const emitMarkdownUpdate = debounce((md: string) => {
		markdown = md;
	}, 150);

	function updateMarkdownFromEditor(): void {
		if (!editorView) return;

		const md = editorView.getMarkdown?.() ?? markdown;
		if (md !== markdown) {
			emitMarkdownUpdate(md);
		}
	}

	function updateEditorFromMarkdown(md: string): void {
		if (!editorView) return;

		const current = editorView.getMarkdown?.();
		if (current === md) return;

		editorView.setMarkdown?.(md);
	}

	$effect(() => {
		if (!browser) return;
		if (!clearDraft) return;

		autoSavePlugin.clear('markdown-editor', docId);
		clearDraft = false;
	});

	$effect(() => {
		if (!browser) return;

		(
			window as Window & {
				__imagePreviewMap?: Record<string, string | undefined>;
			}
		).__imagePreviewMap = Object.fromEntries(
			imageQueue.map((item: ImageQueueItem) => [item.id, item.previewUrl])
		);

		if (editorView?.state) {
			const tr = editorView.state.tr.setMeta('forceUpdate', true);
			editorView.updateState(editorView.state.apply(tr));
		}
	});

	$effect(() => {
		const next = syncImageLinesToQueue(markdown, imageQueue.filter((item): item is Omit<ImageQueueItem, 'file'> & { file: File } => item.file !== undefined));
		if (next !== markdown) {
			markdown = next;
			updateEditorFromMarkdown(next);
		}
	});

	function updateToolbarState(): void {
		if (!editorView) return;

		const { state } = editorView;
		const { from, to } = state.selection;
		const selFrom = state.selection.$from;

		const marks = state.schema.marks;
		const nodes = state.schema.nodes;

		const nextActiveMarks: Partial<Record<ToolbarAction, boolean>> = {};

		for (const [name, mark] of Object.entries(marks)) {
			const action =
				name === 'strong'
					? 'bold'
					: (name as ToolbarAction);

			nextActiveMarks[action] = state.doc.rangeHasMark(from, to, mark);
		}

		activeMarks = nextActiveMarks;

		const nextActiveBlocks: Partial<Record<ToolbarAction, boolean>> = {};
		const parent = selFrom.parent;

		if (nodes.heading && parent.type === nodes.heading) {
			const level = parent.attrs.level;
			if (level === 1) nextActiveBlocks.h1 = true;
			if (level === 2) nextActiveBlocks.h2 = true;
		}

		if (nodes.blockquote && parent.type === nodes.blockquote) {
			nextActiveBlocks.quote = true;
		}

		if (allowHtml) {
			const align = parent.attrs.align;
			if (align === 'left') nextActiveBlocks.alignLeft = true;
			if (align === 'center') nextActiveBlocks.alignCenter = true;
			if (align === 'right') nextActiveBlocks.alignRight = true;
		}

		if (nodes.bullet_list && parent.type === nodes.bullet_list) {
			nextActiveBlocks.ul = true;
		}

		if (nodes.ordered_list && parent.type === nodes.ordered_list) {
			nextActiveBlocks.ol = true;
		}

		if (typeof parent.attrs.checked !== 'undefined') {
			nextActiveBlocks.task = true;
		}

		for (let depth = selFrom.depth; depth > 0; depth -= 1) {
			if (selFrom.node(depth).type.name === 'table') {
				nextActiveBlocks.table = true;
				break;
			}
		}

		activeBlocks = nextActiveBlocks;

		commandStates = {
			bold: getCommandState('bold', state),
			italic: getCommandState('italic', state),
			strike: getCommandState('strike', state),
			h1: getCommandState('h1', state),
			h2: getCommandState('h2', state),
			quote: getCommandState('quote', state),
			alignLeft: getCommandState('alignLeft', state),
			alignCenter: getCommandState('alignCenter', state),
			alignRight: getCommandState('alignRight', state),
			ul: getCommandState('ul', state),
			ol: getCommandState('ol', state),
			table: getCommandState('table', state),
			codeblock: getCommandState('codeblock', state),
			undo: getCommandState('undo', state),
			redo: getCommandState('redo', state),
			link: getCommandState('link', state),
			task: getCommandState('task', state),
			hr: { enabled: true }
		};
	}

	$effect(() => {
		if (!editorView || initializing) return;

		if (docId !== lastAppliedDocId) {
			editorView.setMarkdown?.(markdown);
			lastAppliedDocId = docId;
		}
	});

	onMount(async () => {
		if (!browser || !editorRef) return;

		const [{ setupProseMirror }, controllerModule] = await Promise.all([
			import('./setupProseMirror.js') as Promise<{
				setupProseMirror: SetupProseMirror;
			}>,
			import('./controller/editorController.js') as Promise<EditorController>
		]);

		handleAction = controllerModule.handleAction;
		setEditorView = controllerModule.setEditorView;
		setEditorOptions = controllerModule.setEditorOptions;
		getCommandState = controllerModule.getCommandState;

		editorView = setupProseMirror(
			editorRef,
			markdown,
			imageQueue,
			docId,
			editable,
			allowHtml
		);

		setEditorView(editorView);
		setEditorOptions({ allowHtml });

		editorView.setProps({
			editable: () => editable,
			dispatchTransaction: (transaction) => {
				if (!editorView) return;

				const newState = editorView.state.apply(transaction);
				editorView.updateState(newState);
				updateToolbarState();
			}
		});

		const onPmUpdated: EventListener = () => {
			updateMarkdownFromEditor();
			updateToolbarState();
		};

		editorRef.addEventListener('pm-updated', onPmUpdated);
		removePmUpdatedListener = () => {
			editorRef?.removeEventListener('pm-updated', onPmUpdated);
		};

		initializing = false;
		updateToolbarState();
	});

	function onAction(action: ToolbarAction): void {
		if (!editorView) return;

		handleAction(action);
		updateToolbarState();
	}

	onDestroy(() => {
		removePmUpdatedListener?.();
		editorView?.destroy();
		setEditorView(null);
	});
</script>

<section class="markdown-editor">
	{#if toolbar}
		<EditorToolbar
			{onAction}
			{activeMarks}
			{activeBlocks}
			{commandStates}
			{allowHtml}
		/>
	{/if}

	<div bind:this={editorRef} class="ProseMirror"></div>
</section>