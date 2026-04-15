<script lang="ts">
	import type { ToolbarAction } from '$lib/types/index.js';
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
		Link2Icon,
		Undo2Icon,
		Redo2Icon,
		CodeIcon
	} from '@lucide/svelte';

	type CommandState = {
		enabled: boolean;
		reason?: string;
	};

	let {
		onAction,
		activeMarks = {},
		activeBlocks = {},
		commandStates = {},
		allowHtml = false
	} = $props<{
		onAction: (action: ToolbarAction) => void;
		activeMarks?: Partial<Record<ToolbarAction, boolean>>;
		activeBlocks?: Partial<Record<ToolbarAction, boolean>>;
		commandStates?: Partial<Record<ToolbarAction, CommandState>>;
		allowHtml?: boolean;
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
</script>

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

	<button
		type="button"
		class:active={isActive('table')}
		disabled={!isEnabled('table')}
		onclick={() => handleClick('table')}
		title={getTitle('table', 'Insert table')}
		aria-pressed={isActive('table')}
	>
		<Table2Icon size={18}/>
	</button>

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