<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { FileDialogType, FileDialogProps, FileDialogConfirmDetail } from './types/index.js';

	let {
		type,
		onclose,
		onconfirm
	}: FileDialogProps = $props();

	let selectedFile: File | null = $state(null);
	let exportFormat: 'md' | 'html' = $state('md');

	/**
	 * Handle when a file is selected in the import dialog.
	 */
	function handleFileChange(e: Event): void {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			selectedFile = input.files[0];
		}
	}

	/**
	 * Confirm import: emit selected markdown file as detail.
	 */
	function confirmImport(): void {
		if (!selectedFile) return;
		const detail: FileDialogConfirmDetail = { file: selectedFile };
		onconfirm(new CustomEvent<FileDialogConfirmDetail>('confirm', { detail }));
	}

	/**
	 * Confirm export: emit selected export format as detail.
	 */
	function confirmExport(): void {
		const detail: FileDialogConfirmDetail = { format: exportFormat };
		onconfirm(new CustomEvent<FileDialogConfirmDetail>('confirm', { detail }));
	}
</script>

<div
	role="button"
	tabindex={0}
	class="backdrop"
	onclick={onclose}
	onkeydown={(e) => e.key === 'Enter' && onclose()}
	aria-label="Close dialog"
	transition:fade
>
	<div
		class="dialog"
		tabindex={1}
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
		role="dialog"
		aria-modal="true"
		transition:fade
	>
		{#if type === 'import'}
			<h2>📂 Import Markdown</h2>
			<p>Select a <code>.md</code> file to load into the editor.</p>
			<input type="file" accept=".md,text/markdown" onchange={handleFileChange} />
			<div class="actions">
				<button class="btn cancel" onclick={onclose}>Cancel</button>
				<button class="btn confirm" onclick={confirmImport} disabled={!selectedFile}>
					Import
				</button>
			</div>
		{:else if type === 'export'}
			<h2>💾 Export Document</h2>
			<p>Choose a format to save your current work.</p>
			<div class="options">
				<label>
					<input
						type="radio"
						name="format"
						value="md"
						bind:group={exportFormat}
					/>
					Markdown (.md)
				</label>
				<label>
					<input
						type="radio"
						name="format"
						value="html"
						bind:group={exportFormat}
					/>
					HTML (.html)
				</label>
			</div>
			<div class="actions">
				<button class="btn cancel" onclick={onclose}>Cancel</button>
				<button class="btn confirm" onclick={confirmExport}>Export</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(6px);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.dialog {
		background: rgba(24, 26, 30, 0.9);
		border: 1px solid var(--border);
		border-radius: 16px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
		padding: 2rem;
		width: min(420px, 90%);
		color: var(--text);
		text-align: center;
		animation: fadeIn 0.2s ease;
	}

	h2 {
		margin-top: 0;
		font-size: 1.4rem;
		color: var(--accent);
	}

	p {
		color: var(--muted);
		font-size: 0.9rem;
		margin-bottom: 1rem;
	}

	code {
		background: var(--panel);
		padding: 0.15rem 0.35rem;
		border-radius: 6px;
		color: var(--accent);
		font-size: 0.85rem;
	}

	input[type='file'] {
		display: block;
		margin: 0.5rem auto 1rem;
		color: var(--text);
	}

	.options {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.4rem;
		margin: 0 auto 1rem;
		width: fit-content;
	}

	label {
		color: var(--muted);
		font-size: 0.9rem;
		cursor: pointer;
	}

	input[type='radio'] {
		accent-color: var(--accent);
		margin-right: 0.4rem;
		cursor: pointer;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.btn {
		padding: 0.4rem 0.8rem;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: linear-gradient(180deg, #1b1c20, #15161a);
		color: var(--text);
		cursor: pointer;
		font-size: 0.9rem;
	}

	.btn:hover {
		border-color: #3a3c47;
	}

	.btn.confirm {
		color: var(--accent);
		border-color: var(--accent);
	}

	.btn.confirm:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: scale(0.97);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
