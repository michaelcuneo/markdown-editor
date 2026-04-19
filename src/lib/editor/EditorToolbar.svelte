<script lang="ts">
	import type { ToolbarAction } from '$lib/types/index.js';
	type EditorViewMode = 'wysiwyg' | 'markdown';
	import {
		AlignHorizontalDistributeEndIcon,
		AlignHorizontalDistributeCenterIcon,
		AlignHorizontalDistributeStartIcon,
		BoldIcon,
		Heading1Icon,
		Heading2Icon,
		ItalicIcon,
		StrikethroughIcon,
		QuoteIcon,
		MinusIcon,
		ListIcon,
		ListOrderedIcon,
		ListCheckIcon,
		Table2Icon,
		TableRowsSplitIcon,
		Columns3Icon,
		Rows3Icon,
		Columns2Icon,
		TableCellsMergeIcon,
		ChevronDownIcon,
		Link2Icon,
		Undo2Icon,
		Redo2Icon,
		CodeIcon,
		FileCode2Icon
	} from '@lucide/svelte';

	type CommandState = {
		enabled: boolean;
		reason?: string;
	};

	let {
		onAction,
		onViewModeChange,
		activeMarks = {},
		activeBlocks = {},
		commandStates = {},
		allowHtml = false,
		viewMode = 'wysiwyg'
	} = $props<{
		onAction: (action: ToolbarAction) => void;
		onViewModeChange: (mode: EditorViewMode) => void;
		activeMarks?: Partial<Record<ToolbarAction, boolean>>;
		activeBlocks?: Partial<Record<ToolbarAction, boolean>>;
		commandStates?: Partial<Record<ToolbarAction, CommandState>>;
		allowHtml?: boolean;
		viewMode?: EditorViewMode;
	}>();

	function isActive(action: ToolbarAction): boolean {
		return activeMarks[action] === true || activeBlocks[action] === true;
	}

	function isEnabled(action: ToolbarAction): boolean {
		return commandStates[action]?.enabled ?? true;
	}

	function getTitle(action: ToolbarAction, enabledTitle: string): string {
		return isEnabled(action)
			? enabledTitle
			: commandStates[action]?.reason ?? enabledTitle;
	}

	function handleClick(action: ToolbarAction): void {
		onAction(action);
	}

	function switchViewMode(mode: EditorViewMode): void {
		onViewModeChange(mode);
	}

	function toggleViewMode(): void {
		switchViewMode(viewMode === 'markdown' ? 'wysiwyg' : 'markdown');
	}

	let tablePopoverOpen = $state(false);
	let tablePopoverRef = $state<HTMLDivElement | null>(null);
	let tableTriggerRef = $state<HTMLButtonElement | null>(null);

	function hasTableContext(): boolean {
		return (
			isEnabled('tableAddRow') ||
			isEnabled('tableAddColumn') ||
			isEnabled('tableDeleteRow') ||
			isEnabled('tableDeleteColumn') ||
			isEnabled('tableDelete')
		);
	}

	function toggleTablePopover(): void {
		tablePopoverOpen = !tablePopoverOpen;
	}

	function closeTablePopover(): void {
		tablePopoverOpen = false;
	}

	function onTableAction(action: ToolbarAction): void {
		handleClick(action);
		if (action === 'tableDelete' || action === 'table') {
			closeTablePopover();
		}
	}

	function handleWindowPointerDown(event: PointerEvent): void {
		if (!tablePopoverOpen) return;
		const target = event.target;
		if (!(target instanceof Node)) return;
		if (tablePopoverRef?.contains(target)) return;
		if (tableTriggerRef?.contains(target)) return;
		closeTablePopover();
	}

	function handleWindowKeyDown(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		if (!tablePopoverOpen) return;
		event.preventDefault();
		closeTablePopover();
		tableTriggerRef?.focus();
	}
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeyDown} />

<div class="toolbar" role="toolbar" aria-label="Editor formatting toolbar">
	<button
		type="button"
		class:active={isActive('bold')}
		disabled={!isEnabled('bold')}
		onclick={() => handleClick('bold')}
		title={getTitle('bold', 'Bold (**text**)')}
		aria-pressed={isActive('bold')}
	>
		<BoldIcon size={18}/>
	</button>

	<button
		type="button"
		class:active={isActive('italic')}
		disabled={!isEnabled('italic')}
		onclick={() => handleClick('italic')}
		title={getTitle('italic', 'Italic (*text*)')}
		aria-pressed={isActive('italic')}
	>
		<ItalicIcon size={18}/>
	</button>

	<button
		type="button"
		class:active={isActive('strike')}
		disabled={!isEnabled('strike')}
		onclick={() => handleClick('strike')}
		title={getTitle('strike', 'Strikethrough (~~text~~)')}
		aria-pressed={isActive('strike')}
	>
		<StrikethroughIcon size={18}/>
	</button>

	<button
		type="button"
		class:active={isActive('h1')}
		disabled={!isEnabled('h1')}
		onclick={() => handleClick('h1')}
		title={getTitle('h1', 'Heading 1 (#)')}
		aria-pressed={isActive('h1')}
	>
		<Heading1Icon size={18}/>
	</button>

	<button
		type="button"
		class:active={isActive('h2')}
		disabled={!isEnabled('h2')}
		onclick={() => handleClick('h2')}
		title={getTitle('h2', 'Heading 2 (##)')}
		aria-pressed={isActive('h2')}
	>
		<Heading2Icon size={18}/>
	</button>

	{#if allowHtml}
		<button
			type="button"
			class:active={isActive('alignLeft')}
			disabled={!isEnabled('alignLeft')}
			onclick={() => handleClick('alignLeft')}
			title={getTitle('alignLeft', 'Align left')}
			aria-pressed={isActive('alignLeft')}
		>
			<AlignHorizontalDistributeStartIcon size={18}/>
		</button>

		<button
			type="button"
			class:active={isActive('alignCenter')}
			disabled={!isEnabled('alignCenter')}
			onclick={() => handleClick('alignCenter')}
			title={getTitle('alignCenter', 'Align center')}
			aria-pressed={isActive('alignCenter')}
		>
			<AlignHorizontalDistributeCenterIcon size={18}/>
		</button>

		<button
			type="button"
			class:active={isActive('alignRight')}
			disabled={!isEnabled('alignRight')}
			onclick={() => handleClick('alignRight')}
			title={getTitle('alignRight', 'Align right')}
			aria-pressed={isActive('alignRight')}
		>
			<AlignHorizontalDistributeEndIcon size={18}/>
		</button>
	{/if}

	<button
		type="button"
		class:active={isActive('quote')}
		disabled={!isEnabled('quote')}
		onclick={() => handleClick('quote')}
		title={getTitle('quote', 'Blockquote (>)')}
		aria-pressed={isActive('quote')}
	>
		<QuoteIcon size={18}/>
	</button>

	<button
		type="button"
		disabled={!isEnabled('hr')}
		onclick={() => handleClick('hr')}
		title={getTitle('hr', 'Insert horizontal rule')}
	>
		<MinusIcon size={18}/>
	</button>

	<button
		type="button"
		class:active={isActive('ul')}
		disabled={!isEnabled('ul')}
		onclick={() => handleClick('ul')}
		title={getTitle('ul', 'Unordered List (-, *, +)')}
		aria-pressed={isActive('ul')}
	>
		<ListIcon size={18}/>
	</button>

	<button
		type="button"
		class:active={isActive('ol')}
		disabled={!isEnabled('ol')}
		onclick={() => handleClick('ol')}
		title={getTitle('ol', 'Ordered List (1.)')}
		aria-pressed={isActive('ol')}
	>
		<ListOrderedIcon size={18}/>
	</button>

	<button
		type="button"
		class:active={isActive('task')}
		disabled={!isEnabled('task')}
		onclick={() => handleClick('task')}
		title={getTitle('task', 'Task List (- [ ])')}
		aria-pressed={isActive('task')}
	>
		<ListCheckIcon size={18}/>
	</button>

	<div class="toolbar-popover" bind:this={tablePopoverRef}>
		<button
			bind:this={tableTriggerRef}
			type="button"
			class:active={isActive('table') || tablePopoverOpen || hasTableContext()}
			disabled={!isEnabled('table')}
			onclick={toggleTablePopover}
			title={getTitle('table', 'Table tools')}
			aria-haspopup="menu"
			aria-expanded={tablePopoverOpen}
		>
			<Table2Icon size={18}/>
			<ChevronDownIcon
				class={`toolbar-popover-chevron${tablePopoverOpen ? ' open' : ''}`}
				size={14}
			/>
		</button>

		{#if tablePopoverOpen}
			<div class="toolbar-popover-panel" role="menu" aria-label="Table tools">
				<p class="toolbar-popover-title">Table</p>
				<button
					type="button"
					class="toolbar-popover-item"
					disabled={!isEnabled('table')}
					onclick={() => onTableAction('table')}
					title={getTitle('table', 'Insert table')}
				>
					<Table2Icon size={16}/>
					<span>Insert table</span>
				</button>

				<div class="toolbar-popover-separator" aria-hidden="true"></div>

				<button
					type="button"
					class="toolbar-popover-item"
					disabled={!isEnabled('tableAddRow')}
					onclick={() => onTableAction('tableAddRow')}
					title={getTitle('tableAddRow', 'Table: add row below')}
				>
					<TableRowsSplitIcon size={16}/>
					<span>Add row below</span>
				</button>

				<button
					type="button"
					class="toolbar-popover-item"
					disabled={!isEnabled('tableAddColumn')}
					onclick={() => onTableAction('tableAddColumn')}
					title={getTitle('tableAddColumn', 'Table: add column right')}
				>
					<Columns3Icon size={16}/>
					<span>Add column right</span>
				</button>

				<button
					type="button"
					class="toolbar-popover-item"
					disabled={!isEnabled('tableDeleteRow')}
					onclick={() => onTableAction('tableDeleteRow')}
					title={getTitle('tableDeleteRow', 'Table: delete row')}
				>
					<Rows3Icon size={16}/>
					<span>Delete row</span>
				</button>

				<button
					type="button"
					class="toolbar-popover-item"
					disabled={!isEnabled('tableDeleteColumn')}
					onclick={() => onTableAction('tableDeleteColumn')}
					title={getTitle('tableDeleteColumn', 'Table: delete column')}
				>
					<Columns2Icon size={16}/>
					<span>Delete column</span>
				</button>

				<div class="toolbar-popover-separator" aria-hidden="true"></div>

				<button
					type="button"
					class="toolbar-popover-item toolbar-popover-item-danger"
					disabled={!isEnabled('tableDelete')}
					onclick={() => onTableAction('tableDelete')}
					title={getTitle('tableDelete', 'Table: delete table')}
				>
					<TableCellsMergeIcon size={16}/>
					<span>Delete table</span>
				</button>
			</div>
		{/if}
	</div>

	<button
		type="button"
		class:active={isActive('codeblock')}
		disabled={!isEnabled('codeblock')}
		onclick={() => handleClick('codeblock')}
		title={getTitle('codeblock', 'Code Block (```)')}
		aria-pressed={isActive('codeblock')}
	>
		<CodeIcon size={18}/>
	</button>

	<button
		type="button"
		class:active={isActive('link')}
		disabled={!isEnabled('link')}
		onclick={() => handleClick('link')}
		title={getTitle('link', 'Insert Link (Ctrl/Cmd+K)')}
		aria-pressed={isActive('link')}
	>
		<Link2Icon size={18}/>
	</button>

	<div class="spacer"></div>

	<button
		type="button"
		class="toolbar-mode-toggle"
		class:active={viewMode === 'markdown'}
		onclick={toggleViewMode}
		aria-pressed={viewMode === 'markdown'}
		title={viewMode === 'markdown'
			? 'Switch to visual editor (Ctrl/Cmd+Shift+M)'
			: 'Switch to markdown source mode (Ctrl/Cmd+Shift+M)'}
	>
		<FileCode2Icon size={16}/>
		<span>Markdown</span>
	</button>

	<button
		type="button"
		disabled={!isEnabled('undo')}
		onclick={() => handleClick('undo')}
		title={getTitle('undo', 'Undo (Ctrl/Cmd+Z)')}
	>
		<Undo2Icon size={18}/>
	</button>

	<button
		type="button"
		disabled={!isEnabled('redo')}
		onclick={() => handleClick('redo')}
		title={getTitle('redo', 'Redo (Ctrl/Cmd+Shift+Z)')}
	>
		<Redo2Icon size={18}/>
	</button>
</div>