<script lang="ts">
	import type { ToolbarAction } from './types/index.js';
	
  // 🧩 Props
  let {
    allowHtml = $bindable(false),
    onAction
  }: {
    allowHtml: boolean;
    onAction: (action: ToolbarAction) => void;
  } = $props();
</script>

<div class="toolbar">
  <!-- Formatting -->
  <button type="button" class="btn" title="Bold" onclick={() => onAction('bold')}>
    <strong>B</strong>
  </button>
  <button type="button" class="btn" title="Italic" onclick={() => onAction('italic')}>
    <em>I</em>
  </button>
  <button type="button" class="btn" title="Strike" onclick={() => onAction('strike')}>S̶</button>
  <button type="button" class="btn" title="Quote" onclick={() => onAction('quote')}>&raquo;</button>
  <button type="button" class="btn" title="UL" onclick={() => onAction('ul')}>•</button>
  <button type="button" class="btn" title="OL" onclick={() => onAction('ol')}>1.</button>
  <button type="button" class="btn" title="Task" onclick={() => onAction('task')}>☐</button>
  <button type="button" class="btn" title="Link" onclick={() => onAction('link')}>🔗</button>
  <button type="button" class="btn" title="H1" onclick={() => onAction('h1')}>H1</button>
  <button type="button" class="btn" title="H2" onclick={() => onAction('h2')}>H2</button>
  <button type="button" class="btn" title="Code block" onclick={() => onAction('codeblock')}>
    {"</>"}
  </button>

  <div class="spacer"></div>

  <!-- Undo / Redo -->
  <button type="button" class="btn" title="Undo (Ctrl/Cmd+Z)" onclick={() => onAction('undo')}>
    ⎌ Undo
  </button>
  <button type="button" class="btn" title="Redo (Ctrl/Cmd+Shift+Z)" onclick={() => onAction('redo')}>
    ↻ Redo
  </button>

  <!-- Import / Export -->
  <button type="button" class="btn" title="Import" onclick={() => onAction('import')}>
    📂 Import
  </button>
  <button type="button" class="btn" title="Export" onclick={() => onAction('export')}>
    💾 Export
  </button>

  <!-- Toggle HTML -->
  <label class="allow-html">
    <input
      type="checkbox"
      bind:checked={allowHtml}
      onchange={() => onAction('toggleHtml')}
    />
    <span>Allow HTML</span>
  </label>
</div>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: #0f1012;
  }

  .btn {
    padding: 0.35rem 0.55rem;
    cursor: pointer;
    border: 1px solid var(--border);
    border-radius: 0.6rem;
    background: linear-gradient(180deg, #1b1c20, #15161a);
    color: var(--text);
    font-size: 0.9rem;
  }

  .btn:hover {
    border-color: #3a3c47;
    color: var(--accent);
  }

  .spacer {
    margin-left: auto;
    flex: 1 1 auto;
  }

  .allow-html {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--muted);
    font-size: 0.85rem;
  }

  input[type='checkbox'] {
    accent-color: var(--accent);
    cursor: pointer;
  }
</style>
