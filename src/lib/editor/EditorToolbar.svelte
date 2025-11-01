<script lang="ts">
  import type { ToolbarAction } from '$lib/types/index.js';

  let { onAction, activeMarks = {}, activeBlocks = {}, commandStates = {} } = $props<{
    onAction: (action: ToolbarAction) => void;
    activeMarks?: Record<string, boolean>;
    activeBlocks?: Record<string, boolean>;
    commandStates?: Record<string, { enabled: boolean; reason?: string}>;
  }>();

  function isActive(action: string): boolean {
    return (
      activeMarks[action] === true ||
      activeBlocks[action] === true
    );
  }

  function handleClick(action: ToolbarAction) {
    onAction?.(action);
  }
</script>

<div class="toolbar">
  <!-- Inline Formatting -->
  <button
    class:active={isActive('bold')}
    disabled={!commandStates['bold']?.enabled}
    onclick={() => handleClick('bold')}
    title={commandStates.bold?.enabled ? 'Bold (**text**)' : commandStates.bold?.reason}>
    <strong>B</strong>
  </button>

  <button
    class:active={isActive('italic')}
    disabled={!commandStates['italic']?.enabled}
    onclick={() => handleClick('italic')}
    title={commandStates.italic?.enabled ? 'Italic (*text*)' : commandStates.italic?.reason}>
    <em>I</em>
  </button>

  <button
    class:active={isActive('strike')}
    disabled={!commandStates['strike']?.enabled}
    onclick={() => handleClick('strike')}
    title={commandStates.strike?.enabled ? 'Strikethrough (~~text~~)' : commandStates.strike?.reason}>
    S̶
  </button>

  <!-- Block Formatting -->
  <button
    class:active={isActive('h1')}
    disabled={!commandStates['h1']?.enabled}
    onclick={() => handleClick('h1')}
    title={commandStates.h1?.enabled ? 'Heading 1 (#)' : commandStates.h1?.reason}>
    H1
  </button>

  <button
    class:active={isActive('h2')}
    disabled={!commandStates['h2']?.enabled}
    onclick={() => handleClick('h2')}
    title={commandStates.h2?.enabled ? 'Heading 2 (##)' : commandStates.h2?.reason}>
    H2
  </button>

  <button
    class:active={isActive('quote')}
    disabled={!commandStates['quote']?.enabled}
    onclick={() => handleClick('quote')}
    title={commandStates.quote?.enabled ? 'Blockquote (>)' : commandStates.quote?.reason}>
    &raquo;
  </button>

  <button title="Insert horizontal rule" onclick={() => onAction('hr')}>―</button>

  <!-- Lists -->
  <button
    class:active={isActive('ul')}
    disabled={!commandStates['ul']?.enabled}
    onclick={() => handleClick('ul')}
    title={commandStates.ul?.enabled ? 'Unordered List (-, *, +)' : commandStates.ul?.reason}>
    •
  </button>

  <button
    class:active={isActive('ol')}
    disabled={!commandStates['ol']?.enabled}
    onclick={() => handleClick('ol')}
    title={commandStates.ol?.enabled ? 'Ordered List (1.)' : commandStates.ol?.reason}>
    1.
  </button>

  <button
    class:active={isActive('task')}
    disabled={!commandStates['task']?.enabled}
    onclick={() => handleClick('task')}
    title={commandStates.task?.enabled ? 'Task List (- [ ])' : commandStates.task?.reason}>
    ☑
  </button>

  <!-- Code -->
  <button
    class:active={isActive('codeblock')}
    disabled={!commandStates['codeblock']?.enabled}
    onclick={() => handleClick('codeblock')}
    title={commandStates.codeblock?.enabled ? 'Code Block (```)' : commandStates.codeblock?.reason}>
    {"</>"}
  </button>

  <!-- Links -->
  <button
    class:active={isActive('link')}
    disabled={!commandStates['link']?.enabled}
    onclick={() => handleClick('link')}
    title={commandStates.link?.enabled ? 'Insert Link (Ctrl/Cmd+K)' : commandStates.link?.reason}>
    🔗
  </button>

  <div class="spacer"></div>

  <!-- Undo/Redo -->
  <button onclick={() => handleClick('undo')} title="Undo (Ctrl/Cmd+Z)">
    ⎌
  </button>

  <button onclick={() => handleClick('redo')} title="Redo (Ctrl/Cmd+Shift+Z)">
    ↻
  </button>
</div>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem;
    border-radius: 8px;
    border: 1px solid var(--border, #2c2d30);
    background: var(--toolbar-bg, #0f1012);
  }
  button {
    border: 1px solid transparent;
    background: none;
    color: #ddd;
    font-size: 0.9rem;
    padding: 0.35rem 0.55rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  button:hover {
    background: rgba(79, 131, 255, 0.1);
    border-color: rgba(79, 131, 255, 0.2);
    color: #4f83ff;
  }
  button.active {
    background: rgba(79, 131, 255, 0.2);
    border-color: #4f83ff;
    color: #4f83ff;
  }
  .button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    filter: grayscale(0.4);
  }
  .button:disabled:hover {
    border-color: var(--border);
    color: var(--muted);
    background: none;
  }
  .spacer {
    flex: 1 1 auto;
  }
  @media (prefers-color-scheme: light) {
    .toolbar {
      background: #fafafa;
      border-color: #ddd;
    }
    button {
      color: #333;
    }
    button.active {
      background: rgba(79, 131, 255, 0.15);
      color: #0b57d0;
      border-color: #4f83ff;
    }
  }
</style>
