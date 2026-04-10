<script lang="ts">
	import type { ToolbarAction } from '$lib/types/index.js';

	type CommandState = {
		enabled: boolean;
		reason?: string;
	};

	let {
		onAction,
		activeMarks = {},
		activeBlocks = {},
		commandStates = {}
	} = $props<{
		onAction: (action: ToolbarAction) => void;
		activeMarks?: Partial<Record<ToolbarAction, boolean>>;
		activeBlocks?: Partial<Record<ToolbarAction, boolean>>;
		commandStates?: Partial<Record<ToolbarAction, CommandState>>;
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
		<strong>B</strong>
	</button>

	<button
		type="button"
		class:active={isActive('italic')}
		disabled={!isEnabled('italic')}
		onclick={() => handleClick('italic')}
		title={getTitle('italic', 'Italic (*text*)')}
		aria-pressed={isActive('italic')}
	>
		<em>I</em>
	</button>

	<button
		type="button"
		class:active={isActive('strike')}
		disabled={!isEnabled('strike')}
		onclick={() => handleClick('strike')}
		title={getTitle('strike', 'Strikethrough (~~text~~)')}
		aria-pressed={isActive('strike')}
	>
		S̶
	</button>

	<button
		type="button"
		class:active={isActive('h1')}
		disabled={!isEnabled('h1')}
		onclick={() => handleClick('h1')}
		title={getTitle('h1', 'Heading 1 (#)')}
		aria-pressed={isActive('h1')}
	>
		H1
	</button>

	<button
		type="button"
		class:active={isActive('h2')}
		disabled={!isEnabled('h2')}
		onclick={() => handleClick('h2')}
		title={getTitle('h2', 'Heading 2 (##)')}
		aria-pressed={isActive('h2')}
	>
		H2
	</button>

	<button
		type="button"
		class:active={isActive('quote')}
		disabled={!isEnabled('quote')}
		onclick={() => handleClick('quote')}
		title={getTitle('quote', 'Blockquote (>)')}
		aria-pressed={isActive('quote')}
	>
		&raquo;
	</button>

	<button
		type="button"
		disabled={!isEnabled('hr')}
		onclick={() => handleClick('hr')}
		title={getTitle('hr', 'Insert horizontal rule')}
	>
		―
	</button>

	<button
		type="button"
		class:active={isActive('ul')}
		disabled={!isEnabled('ul')}
		onclick={() => handleClick('ul')}
		title={getTitle('ul', 'Unordered List (-, *, +)')}
		aria-pressed={isActive('ul')}
	>
		•
	</button>

	<button
		type="button"
		class:active={isActive('ol')}
		disabled={!isEnabled('ol')}
		onclick={() => handleClick('ol')}
		title={getTitle('ol', 'Ordered List (1.)')}
		aria-pressed={isActive('ol')}
	>
		1.
	</button>

	<button
		type="button"
		class:active={isActive('task')}
		disabled={!isEnabled('task')}
		onclick={() => handleClick('task')}
		title={getTitle('task', 'Task List (- [ ])')}
		aria-pressed={isActive('task')}
	>
		☑
	</button>

	<button
		type="button"
		class:active={isActive('codeblock')}
		disabled={!isEnabled('codeblock')}
		onclick={() => handleClick('codeblock')}
		title={getTitle('codeblock', 'Code Block (```)')}
		aria-pressed={isActive('codeblock')}
	>
		&lt;/&gt;
	</button>

	<button
		type="button"
		class:active={isActive('link')}
		disabled={!isEnabled('link')}
		onclick={() => handleClick('link')}
		title={getTitle('link', 'Insert Link (Ctrl/Cmd+K)')}
		aria-pressed={isActive('link')}
	>
		🔗
	</button>

	<div class="spacer"></div>

	<button
		type="button"
		disabled={!isEnabled('undo')}
		onclick={() => handleClick('undo')}
		title={getTitle('undo', 'Undo (Ctrl/Cmd+Z)')}
	>
		⎌
	</button>

	<button
		type="button"
		disabled={!isEnabled('redo')}
		onclick={() => handleClick('redo')}
		title={getTitle('redo', 'Redo (Ctrl/Cmd+Shift+Z)')}
	>
		↻
	</button>
</div>