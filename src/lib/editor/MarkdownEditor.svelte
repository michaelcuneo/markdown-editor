<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { EditorState } from 'prosemirror-state';
	import type { EditorView } from 'prosemirror-view';

	import EditorToolbar from './EditorToolbar.svelte';
	import type { ToolbarAction } from '../types/index.js';
	import type { ImageUploadPayload, MarkdownImageOptions, MarkdownImageVariant } from '../types/index.js';
	import { autoSavePlugin } from './plugins/autoSavePlugin.js';
	import { syncImageLinesToQueue } from './utils/useImageSync.js';
	import {
		buildSrcSet,
		DEFAULT_SHARPLESS_QUALITY,
		optimiseImageWithSharpless,
		type OptimizationSource,
		type SharplessTarget
	} from './utils/sharpless.js';

	type ImageQueueItem = {
		id: string;
		file?: File;
		originalFile?: File;
		name?: string;
		type?: string;
		size?: number;
		previewUrl?: string;
		srcSet?: string;
		quality?: number;
		optimizationSource?: OptimizationSource;
		format?: string;
		variants?: Array<{
			label: string;
			format: string;
			width: number;
			height: number;
			size: number;
			url: string;
		}>;
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
		imageQueue?: Record<string, ImageQueueItem>,
		docId?: string,
		editable?: boolean,
		allowHtml?: boolean,
		imageOptions?: MarkdownImageOptions
	) => ExtendedEditorView;

	type PreviewRegistryWindow = Window & {
		__imageFileMap?: Record<string, File>;
	};

	type EditorViewMode = 'wysiwyg' | 'markdown';
	type TextSelectionDirection = 'forward' | 'backward' | 'none';
	type TextSelectionSnapshot = {
		start: number;
		end: number;
		direction: TextSelectionDirection;
	};
	type MarkdownTableContext = {
		start: number;
		end: number;
		currentRowIndex: number | null;
		currentColumnIndex: number;
		rows: string[][];
		columnCount: number;
	};

	const isBrowser = typeof window !== 'undefined';
	const dividerPattern = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*(?:\s*:?-{3,}:?\s*)?\|?\s*$/;

	function debounce<T extends (...args: never[]) => void>(fn: T, delay = 250) {
		let timer: ReturnType<typeof setTimeout> | undefined;

		return (...args: Parameters<T>) => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => fn(...args), delay);
		};
	}

	function extractReferencedImageIds(md: string): Record<string, true> {
		const ids: Record<string, true> = {};

		for (const match of md.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
			const src = match[1]?.trim();
			if (src) ids[src] = true;
		}

		for (const match of md.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
			const src = match[1]?.trim();
			if (src) ids[src] = true;
		}

		return ids;
	}

	let {
		markdown = $bindable(''),
		toolbar = true,
		imageQueue = $bindable({} as Record<string, ImageQueueItem>),
		clearDraft = $bindable(false),
		docId = 'default',
		editable = true,
		allowHtml = false,
		viewMode = $bindable('wysiwyg' as EditorViewMode),
		imageOptions = {} as MarkdownImageOptions
	} = $props();

	let editorRef = $state<HTMLDivElement | null>(null);
	let editorShellRef = $state<HTMLElement | null>(null);
	let markdownSourceRef = $state<HTMLTextAreaElement | null>(null);
	let editorView = $state<ExtendedEditorView | null>(null);
	let initializing = $state(true);
	let lastAppliedDocId = $state<string | null>(null);
	let markdownSelection = $state<TextSelectionSnapshot>({
		start: 0,
		end: 0,
		direction: 'none'
	});

	let commandStates = $state<Partial<Record<ToolbarAction, CommandState>>>({});
	let activeMarks = $state<Partial<Record<ToolbarAction, boolean>>>({});
	let activeBlocks = $state<Partial<Record<ToolbarAction, boolean>>>({});
	let markdownCommandStates = $state<Partial<Record<ToolbarAction, CommandState>>>({});
	let markdownActiveMarks = $state<Partial<Record<ToolbarAction, boolean>>>({});
	let markdownActiveBlocks = $state<Partial<Record<ToolbarAction, boolean>>>({});

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

	function updateMarkdownFromEditorImmediate(): void {
		if (!editorView) return;

		const md = editorView.getMarkdown?.() ?? markdown;
		if (md !== markdown) {
			markdown = md;
		}
	}

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

	function clamp(value: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, value));
	}

	function syncMarkdownSelection(): void {
		if (!markdownSourceRef) return;

		markdownSelection = {
			start: markdownSourceRef.selectionStart ?? 0,
			end: markdownSourceRef.selectionEnd ?? 0,
			direction: (markdownSourceRef.selectionDirection ?? 'none') as TextSelectionDirection
		};
		refreshMarkdownToolbarState();
	}

	function getMarkdownSelection(): TextSelectionSnapshot {
		if (!markdownSourceRef) return markdownSelection;

		return {
			start: markdownSourceRef.selectionStart ?? markdownSelection.start,
			end: markdownSourceRef.selectionEnd ?? markdownSelection.end,
			direction: (markdownSourceRef.selectionDirection ?? markdownSelection.direction) as TextSelectionDirection
		};
	}

	function applySourceReplacement(
		replaceStart: number,
		replaceEnd: number,
		replacement: string,
		nextSelection: TextSelectionSnapshot
	): void {
		if (!markdownSourceRef) return;

		markdownSourceRef.focus();
		markdownSourceRef.setSelectionRange(replaceStart, replaceEnd, markdownSelection.direction);
		markdownSourceRef.setRangeText(replacement, replaceStart, replaceEnd, 'end');

		markdown = markdownSourceRef.value;
		updateEditorFromMarkdown(markdown);

		const selectionStart = clamp(nextSelection.start, 0, markdownSourceRef.value.length);
		const selectionEnd = clamp(nextSelection.end, 0, markdownSourceRef.value.length);

		markdownSourceRef.setSelectionRange(selectionStart, selectionEnd, nextSelection.direction);
		syncMarkdownSelection();
	}

	function getLineStart(text: string, index: number): number {
		const safeIndex = clamp(index, 0, text.length);
		const breakIndex = text.lastIndexOf('\n', Math.max(0, safeIndex - 1));
		return breakIndex === -1 ? 0 : breakIndex + 1;
	}

	function getLineEnd(text: string, index: number): number {
		const safeIndex = clamp(index, 0, text.length);
		const breakIndex = text.indexOf('\n', safeIndex);
		return breakIndex === -1 ? text.length : breakIndex;
	}

	function getSelectedLineRange(text: string, start: number, end: number): { start: number; end: number } {
		const lineStart = getLineStart(text, start);
		const effectiveEnd = end > start ? end - 1 : end;
		const lineEnd = getLineEnd(text, effectiveEnd);
		return { start: lineStart, end: lineEnd };
	}

	function getCurrentMarkdownLine(): string {
		const { start } = getMarkdownSelection();
		const lineStart = getLineStart(markdown, start);
		const lineEnd = getLineEnd(markdown, start);
		return markdown.slice(lineStart, lineEnd);
	}

	function getCurrentMarkdownLineOffset(): number {
		const { start } = getMarkdownSelection();
		return start - getLineStart(markdown, start);
	}

	function hasInlineWrapper(prefix: string, suffix: string): boolean {
		const { start, end } = getMarkdownSelection();
		if (start !== end) {
			return (
				markdown.slice(Math.max(0, start - prefix.length), start) === prefix &&
				markdown.slice(end, end + suffix.length) === suffix
			);
		}

		const line = getCurrentMarkdownLine();
		const lineOffset = getCurrentMarkdownLineOffset();
		let searchFrom = 0;

		while (searchFrom <= line.length) {
			const openIndex = line.indexOf(prefix, searchFrom);
			if (openIndex === -1) break;

			const contentStart = openIndex + prefix.length;
			const closeIndex = line.indexOf(suffix, contentStart);
			if (closeIndex === -1) break;

			if (lineOffset >= contentStart && lineOffset <= closeIndex) {
				return true;
			}

			searchFrom = closeIndex + suffix.length;
		}

		return false;
	}

	function hasActiveMarkdownLink(): boolean {
		const { start, end } = getMarkdownSelection();
		const line = getCurrentMarkdownLine();
		const lineStart = getLineStart(markdown, start);
		const selectionStart = start - lineStart;
		const selectionEnd = end - lineStart;
		const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;

		for (const match of line.matchAll(linkPattern)) {
			const matchStart = match.index ?? -1;
			if (matchStart < 0) continue;
			const matchText = match[0] ?? '';
			const matchEnd = matchStart + matchText.length;

			if (start === end) {
				if (selectionStart >= matchStart && selectionStart <= matchEnd) return true;
				continue;
			}

			if (selectionStart >= matchStart && selectionEnd <= matchEnd) return true;
		}

		return false;
	}

	function wrapSelection(prefix: string, suffix: string, placeholder: string): void {
		const { start, end, direction } = getMarkdownSelection();
		const selectedText = markdown.slice(start, end);
		const innerText = selectedText || placeholder;
		const replacement = `${prefix}${innerText}${suffix}`;
		const innerStart = start + prefix.length;

		applySourceReplacement(start, end, replacement, {
			start: innerStart,
			end: innerStart + innerText.length,
			direction
		});
	}

	function transformSelectedLines(transform: (lines: string[]) => string[]): void {
		const { start, end, direction } = getMarkdownSelection();
		const lineRange = getSelectedLineRange(markdown, start, end);
		const source = markdown.slice(lineRange.start, lineRange.end);
		const nextLines = transform(source.split('\n'));
		const replacement = nextLines.join('\n');

		applySourceReplacement(lineRange.start, lineRange.end, replacement, {
			start: lineRange.start,
			end: lineRange.start + replacement.length,
			direction
		});
	}

	function togglePrefixedLines(
		matcher: RegExp,
		addPrefix: (line: string, index: number) => string,
		stripPrefix: (line: string) => string
	): void {
		transformSelectedLines((lines) => {
			const contentLines = lines.filter((line) => line.trim().length > 0);
			const shouldRemove = contentLines.length > 0 && contentLines.every((line) => matcher.test(line));

			return lines.map((line, index) => {
				if (!line.trim()) return line;
				return shouldRemove ? stripPrefix(line) : addPrefix(line, index);
			});
		});
	}

	function normalizeForList(line: string): string {
		return line
			.replace(/^\s*>\s?/, '')
			.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, '')
			.replace(/^\s*[-*+]\s+/, '')
			.replace(/^\s*\d+\.\s+/, '');
	}

	function wrapSelectionInBlock(opening: string, closing: string, placeholder: string): void {
		const { start, end, direction } = getMarkdownSelection();
		const selectedText = markdown.slice(start, end).trim();
		const innerText = selectedText || placeholder;
		const replacement = `${opening}\n${innerText}\n${closing}`;
		const innerStart = start + opening.length + 1;

		applySourceReplacement(start, end, replacement, {
			start: innerStart,
			end: innerStart + innerText.length,
			direction
		});
	}

	function insertBlock(content: string, cursorOffset = content.length): void {
		const { start, end, direction } = getMarkdownSelection();
		const needsLeadingBreak = start > 0 && markdown[start - 1] !== '\n';
		const needsTrailingBreak = end < markdown.length && markdown[end] !== '\n';
		const replacement = `${needsLeadingBreak ? '\n' : ''}${content}${needsTrailingBreak ? '\n' : ''}`;
		const cursor = start + (needsLeadingBreak ? 1 : 0) + cursorOffset;

		applySourceReplacement(start, end, replacement, {
			start: cursor,
			end: cursor,
			direction
		});
	}

	function getCurrentLineIndex(text: string, position: number): number {
		let lineIndex = 0;
		for (let offset = 0; offset < clamp(position, 0, text.length); offset += 1) {
			if (text[offset] === '\n') lineIndex += 1;
		}
		return lineIndex;
	}

	function parseTableRow(line: string): string[] {
		const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
		return trimmed.split('|').map((cell) => cell.trim());
	}

	function formatTableRow(cells: string[]): string {
		return `| ${cells.map((cell) => cell.trim()).join(' | ')} |`;
	}

	function getTableColumnIndex(line: string, cursorOffset: number, columnCount: number): number {
		const safeOffset = clamp(cursorOffset, 0, line.length);
		const leadingPipe = line.trimStart().startsWith('|');
		let pipeCount = 0;

		for (let index = 0; index < safeOffset; index += 1) {
			if (line[index] === '|') pipeCount += 1;
		}

		const rawIndex = leadingPipe ? pipeCount - 1 : pipeCount;
		return clamp(rawIndex, 0, Math.max(0, columnCount - 1));
	}

	function getMarkdownTableContext(position = getMarkdownSelection().start): MarkdownTableContext | null {
		const lines = markdown.split('\n');
		let offset = 0;
		const lineOffsets = lines.map((line) => {
			const start = offset;
			offset += line.length + 1;
			return start;
		});

		const currentLineIndex = getCurrentLineIndex(markdown, position);
		const currentLine = lines[currentLineIndex];
		if (!currentLine?.includes('|')) return null;

		let startLine = currentLineIndex;
		let endLine = currentLineIndex;

		while (startLine > 0 && (lines[startLine - 1] ?? '').includes('|')) startLine -= 1;
		while (endLine < lines.length - 1 && (lines[endLine + 1] ?? '').includes('|')) endLine += 1;

		const blockLines = lines.slice(startLine, endLine + 1);
		const dividerIndex = blockLines.findIndex((line) => dividerPattern.test(line));
		if (dividerIndex <= 0) return null;

		const rows = blockLines
			.filter((_, index) => index !== dividerIndex)
			.map((line) => parseTableRow(line));
		if (rows.length === 0) return null;

		const columnCount = Math.max(2, ...rows.map((row) => row.length));
		const normalizedRows = rows.map((row) => {
			const nextRow = row.slice(0, columnCount);
			while (nextRow.length < columnCount) nextRow.push('');
			return nextRow;
		});

		const absoluteDividerLine = startLine + dividerIndex;
		const currentRowIndex =
			currentLineIndex === absoluteDividerLine
				? null
				: currentLineIndex < absoluteDividerLine
					? currentLineIndex - startLine
					: currentLineIndex - startLine - 1;

		const currentColumnIndex = getTableColumnIndex(
			currentLine,
			position - (lineOffsets[currentLineIndex] ?? 0),
			columnCount
		);

		const startOffset = lineOffsets[startLine];
		const endLineText = lines[endLine];
		const endOffset = lineOffsets[endLine];
		if (typeof startOffset !== 'number' || typeof endOffset !== 'number' || typeof endLineText !== 'string') {
			return null;
		}

		return {
			start: startOffset,
			end: endOffset + endLineText.length,
			currentRowIndex,
			currentColumnIndex,
			rows: normalizedRows,
			columnCount
		};
	}

	function serializeMarkdownTable(rows: string[][], columnCount: number): string {
		if (rows.length === 0) return '';

		const normalizedRows = rows.map((row, rowIndex) => {
			const nextRow = row.slice(0, columnCount);
			while (nextRow.length < columnCount) nextRow.push('');
			if (rowIndex === 0) {
				nextRow.forEach((cell, index) => {
					if (!cell.trim()) nextRow[index] = `Column ${index + 1}`;
				});
			}
			return nextRow;
		});

		const divider = `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`;
		const headerRow = normalizedRows[0];
		if (!headerRow) return divider;

		return [
			formatTableRow(headerRow),
			divider,
			...normalizedRows.slice(1).map((row) => formatTableRow(row))
		].join('\n');
	}

	function applyTableEdit(
		transform: (context: MarkdownTableContext) => {
			content: string;
			selectionStart?: number;
			selectionEnd?: number;
		} | null
	): void {
		const context = getMarkdownTableContext();
		if (!context) return;

		const next = transform(context);
		if (!next) return;

		applySourceReplacement(context.start, context.end, next.content, {
			start: next.selectionStart ?? context.start,
			end: next.selectionEnd ?? next.selectionStart ?? context.start,
			direction: getMarkdownSelection().direction
		});
	}

	function getMarkdownCommandStates(): Partial<Record<ToolbarAction, CommandState>> {
		const inTable = getMarkdownTableContext();
		const editableState = editable === true;

		return {
			bold: { enabled: editableState },
			italic: { enabled: editableState },
			strike: { enabled: editableState },
			h1: { enabled: editableState },
			h2: { enabled: editableState },
			quote: { enabled: editableState },
			alignLeft: allowHtml
				? { enabled: editableState }
				: { enabled: false, reason: 'HTML mode is disabled' },
			alignCenter: allowHtml
				? { enabled: editableState }
				: { enabled: false, reason: 'HTML mode is disabled' },
			alignRight: allowHtml
				? { enabled: editableState }
				: { enabled: false, reason: 'HTML mode is disabled' },
			ul: { enabled: editableState },
			ol: { enabled: editableState },
			task: { enabled: editableState },
			table: { enabled: editableState },
			tableAddRow: inTable
				? { enabled: editableState }
				: { enabled: false, reason: 'Place cursor inside a markdown table' },
			tableAddColumn: inTable
				? { enabled: editableState }
				: { enabled: false, reason: 'Place cursor inside a markdown table' },
			tableDeleteRow: inTable
				? { enabled: editableState }
				: { enabled: false, reason: 'Place cursor inside a markdown table' },
			tableDeleteColumn: inTable
				? { enabled: editableState }
				: { enabled: false, reason: 'Place cursor inside a markdown table' },
			tableDelete: inTable
				? { enabled: editableState }
				: { enabled: false, reason: 'Place cursor inside a markdown table' },
			codeblock: { enabled: editableState },
			hr: { enabled: editableState },
			link: { enabled: editableState },
			undo: { enabled: false, reason: 'Use native textarea undo in markdown mode' },
			redo: { enabled: false, reason: 'Use native textarea redo in markdown mode' }
		};
	}

	function getMarkdownActiveBlocks(): Partial<Record<ToolbarAction, boolean>> {
		const { start, end } = getMarkdownSelection();
		const lineRange = getSelectedLineRange(markdown, start, end);
		const lines = markdown.slice(lineRange.start, lineRange.end).split('\n');
		const contentLines = lines.filter((line) => line.trim().length > 0);
		const tableContext = getMarkdownTableContext();
		const fenceCount = markdown.slice(0, start).match(/^```/gm)?.length ?? 0;

		return {
			h1: contentLines.length > 0 && contentLines.every((line) => /^#\s+/.test(line)),
			h2: contentLines.length > 0 && contentLines.every((line) => /^##\s+/.test(line)),
			quote: contentLines.length > 0 && contentLines.every((line) => /^\s*>\s?/.test(line)),
			ul: contentLines.length > 0 && contentLines.every((line) => /^\s*[-*+]\s+/.test(line)),
			ol: contentLines.length > 0 && contentLines.every((line) => /^\s*\d+\.\s+/.test(line)),
			task: contentLines.length > 0 && contentLines.every((line) => /^\s*[-*+]\s+\[[ xX]\]\s+/.test(line)),
			table: tableContext !== null,
			codeblock: fenceCount % 2 === 1
		};
	}

	function getMarkdownActiveMarks(): Partial<Record<ToolbarAction, boolean>> {
		return {
			bold: hasInlineWrapper('**', '**'),
			italic: hasInlineWrapper('*', '*'),
			strike: hasInlineWrapper('~~', '~~'),
			link: hasActiveMarkdownLink()
		};
	}

	function refreshMarkdownToolbarState(): void {
		markdownCommandStates = getMarkdownCommandStates();
		markdownActiveMarks = getMarkdownActiveMarks();
		markdownActiveBlocks = getMarkdownActiveBlocks();
	}

	function applyMarkdownAction(action: ToolbarAction): void {
		if (!editable) return;

		switch (action) {
			case 'bold':
				wrapSelection('**', '**', 'bold text');
				break;

			case 'italic':
				wrapSelection('*', '*', 'italic text');
				break;

			case 'strike':
				wrapSelection('~~', '~~', 'struck text');
				break;

			case 'h1':
				togglePrefixedLines(/^#\s+/, (line) => `# ${line.replace(/^#+\s+/, '')}`, (line) => line.replace(/^#\s+/, ''));
				break;

			case 'h2':
				togglePrefixedLines(/^##\s+/, (line) => `## ${line.replace(/^#+\s+/, '')}`, (line) => line.replace(/^##\s+/, ''));
				break;
			case 'quote':
				togglePrefixedLines(/^\s*>\s?/, (line) => `> ${line.replace(/^\s*>\s?/, '')}`, (line) => line.replace(/^\s*>\s?/, ''));
				break;

			case 'alignLeft':
				wrapSelectionInBlock('<div align="left">', '</div>', 'Aligned content');
				break;

			case 'alignCenter':
				wrapSelectionInBlock('<div align="center">', '</div>', 'Aligned content');
				break;

			case 'alignRight':
				wrapSelectionInBlock('<div align="right">', '</div>', 'Aligned content');
				break;

			case 'ul':
				togglePrefixedLines(/^\s*[-*+]\s+/, (line) => `- ${normalizeForList(line)}`, (line) => line.replace(/^\s*[-*+]\s+/, ''));
				break;

			case 'ol':
				togglePrefixedLines(/^\s*\d+\.\s+/, (line, index) => `${index + 1}. ${normalizeForList(line)}`, (line) => line.replace(/^\s*\d+\.\s+/, ''));
				break;

			case 'task':
				togglePrefixedLines(/^\s*[-*+]\s+\[[ xX]\]\s+/, (line) => `- [ ] ${normalizeForList(line)}`, (line) => line.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, ''));
				break;

			case 'table': {
				const tableText = '| Column 1 | Column 2 |\n| --- | --- |\n| Value 1 | Value 2 |';
				insertBlock(tableText, tableText.indexOf('Column 1'));
				break;
			}

			case 'tableAddRow':
				applyTableEdit((context) => {
					const rows = context.rows.map((row) => [...row]);
					const insertIndex = (context.currentRowIndex ?? 0) + 1;
					rows.splice(insertIndex, 0, Array.from({ length: context.columnCount }, () => ''));
					return {
						content: serializeMarkdownTable(rows, context.columnCount)
					};
				});
				break;

			case 'tableAddColumn':
				applyTableEdit((context) => {
					const insertIndex = context.currentColumnIndex + 1;
					const rows = context.rows.map((row, rowIndex) => {
						const nextRow = [...row];
						nextRow.splice(insertIndex, 0, rowIndex === 0 ? `Column ${insertIndex + 1}` : '');
						return nextRow;
					});
					return {
						content: serializeMarkdownTable(rows, context.columnCount + 1)
					};
				});
				break;

			case 'tableDeleteRow':
				applyTableEdit((context) => {
					if (context.rows.length <= 1) return null;

					const removeIndex = context.currentRowIndex ?? 0;
					const rows = context.rows.filter((_, index) => index !== removeIndex);
					return {
						content: serializeMarkdownTable(rows, context.columnCount)
					};
				});
				break;

			case 'tableDeleteColumn':
				applyTableEdit((context) => {
					const nextColumnCount = Math.max(1, context.columnCount - 1);
					const rows = context.rows.map((row) => row.filter((_, index) => index !== context.currentColumnIndex));
					return {
						content: serializeMarkdownTable(rows, nextColumnCount)
					};
				});
				break;

			case 'tableDelete':
				applyTableEdit((context) => ({
					content: '',
					selectionStart: context.start,
					selectionEnd: context.start
				}));
				break;

			case 'codeblock':
				wrapSelectionInBlock('```', '```', 'code');
				break;

			case 'hr':
				insertBlock('---');
				break;

			case 'link': {
				let url = prompt('Enter URL:')?.trim();
				if (!url) break;

				if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) {
					url = `https://${url}`;
				}

				const { start, end, direction } = getMarkdownSelection();
				const label = markdown.slice(start, end) || 'link text';
				const replacement = `[${label}](${url})`;
				const labelStart = start + 1;

				applySourceReplacement(start, end, replacement, {
					start: labelStart,
					end: labelStart + label.length,
					direction
				});
				break;
			}

			case 'undo':
			case 'redo':
				if (!isBrowser || !markdownSourceRef) break;
				markdownSourceRef.focus();
				document.execCommand(action === 'undo' ? 'undo' : 'redo');
				markdown = markdownSourceRef.value;
				updateEditorFromMarkdown(markdown);
				syncMarkdownSelection();
				break;

			default:
				break;
		}
	}

	$effect(() => {
		if (!isBrowser) return;
		if (!clearDraft) return;

		autoSavePlugin.clear('markdown-editor', docId);
		clearDraft = false;
	});

	$effect(() => {
		if (!isBrowser) return;

		// Merge new entries into the preview map rather than replacing it,
		// so entries written synchronously by imageDropPlugin are not lost.
		const _win = window as Window & { __imagePreviewMap?: Record<string, string | undefined> };
		if (!_win.__imagePreviewMap) _win.__imagePreviewMap = {};
		const _debugWin = window as Window & {
			__imageOptimizeSourceMap?: Record<string, string | undefined>;
		};
		if (!_debugWin.__imageOptimizeSourceMap) _debugWin.__imageOptimizeSourceMap = {};
		for (const item of Object.values(imageQueue)) {
			if (item.previewUrl) _win.__imagePreviewMap[item.id] = item.previewUrl;
			if (item.optimizationSource) {
				_debugWin.__imageOptimizeSourceMap[item.id] = item.optimizationSource;
			}
		}

		// Defer to the next microtask so multiple synchronous queue mutations
		// (e.g. from the restore splice) coalesce into a single transaction.
		Promise.resolve().then(() => {
			if (editorView?.state) {
				const tr = editorView.state.tr.setMeta('forceUpdate', true);
				editorView.updateState(editorView.state.apply(tr));
			}
		});
	});

	$effect(() => {
		const next = syncImageLinesToQueue(
			markdown,
			Object.values(imageQueue).filter((item): item is ImageQueueItem & { file: File } => !!item.file) as Array<ImageQueueItem & { file: File }>
		);
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
			tableAddRow: getCommandState('tableAddRow', state),
			tableAddColumn: getCommandState('tableAddColumn', state),
			tableDeleteRow: getCommandState('tableDeleteRow', state),
			tableDeleteColumn: getCommandState('tableDeleteColumn', state),
			tableDelete: getCommandState('tableDelete', state),
			hr: { enabled: true }
		};
	}

	async function resolveOptimiseSourceFile(
		id: string,
		queueItem: ImageQueueItem | undefined
	): Promise<File | undefined> {
		const directFile = queueItem?.originalFile ?? queueItem?.file;
		if (directFile) return directFile;

		const w = window as PreviewRegistryWindow;
		const mappedFile = w.__imageFileMap?.[id];
		if (mappedFile) return mappedFile;

		if (!editorView) return undefined;
		const imageType = editorView.state.schema.nodes.image;
		if (!imageType) return undefined;

		let candidateUrl: string | null = null;
		editorView.state.doc.descendants((node) => {
			if (candidateUrl) return;
			if (node.type !== imageType) return;
			if (node.attrs.src !== id) return;
			const previewSrc = node.attrs.previewSrc;
			const src = node.attrs.src;
			if (typeof previewSrc === 'string' && previewSrc.startsWith('blob:')) {
				candidateUrl = previewSrc;
				return;
			}
			if (typeof src === 'string' && src.startsWith('blob:')) {
				candidateUrl = src;
			}
		});

		if (!candidateUrl) return undefined;

		try {
			const response = await fetch(candidateUrl);
			if (!response.ok) return undefined;
			const blob = await response.blob();
			const mimeType = blob.type || queueItem?.type || 'application/octet-stream';
			const ext = mimeType.includes('/') ? mimeType.split('/')[1] : 'bin';
			const name = queueItem?.name || `image-${Date.now()}.${ext}`;
			return new File([blob], name, { type: mimeType });
		} catch {
			return undefined;
		}
	}

	async function optimiseImageById(
		id: string,
		quality = DEFAULT_SHARPLESS_QUALITY,
		widths: number[] = [480, 1024, 1920],
		primaryFormat = 'image/webp'
	): Promise<void> {
		if (imageOptions.enableOptimization !== true) return;
		if (!editorView) return;
		const queueItem = imageQueue[id];
		const sourceFile = await resolveOptimiseSourceFile(id, queueItem);
		if (!sourceFile) return;

		const w = window as PreviewRegistryWindow;
		if (!w.__imageFileMap) w.__imageFileMap = {};
		w.__imageFileMap[id] = sourceFile;

		const targets: SharplessTarget[] = widths.map((width, index) => ({
			width,
			label: index === 0 ? 'mobile' : index === 1 ? 'tablet' : `w${width}`
		}));

		const results = await optimiseImageWithSharpless(sourceFile, {
			quality,
			targets,
			formats: imageOptions.formats ?? ['image/webp', 'image/jpeg', 'image/avif']
		});

		const variants = results.map((item) => ({
			...item,
			url: URL.createObjectURL(item.blob)
		}));

		const uploadVariants: MarkdownImageVariant[] = variants.map((variant) => ({
			label: variant.label,
			format: variant.format,
			width: variant.width,
			height: variant.height,
			size: variant.size,
			url: variant.url,
			blob: variant.blob
		}));

		const srcSet = buildSrcSet(variants, primaryFormat);
		const preview =
			variants.find((item) => item.format === primaryFormat) || variants[variants.length - 1];
		const optimizationSource =
			(results[0]?.source as OptimizationSource | undefined) ?? 'original-fallback';

		imageQueue[id] = {
			...queueItem,
			id,
			file: sourceFile,
			originalFile: sourceFile,
			quality,
			optimizationSource,
			previewUrl: preview?.url ?? queueItem?.previewUrl,
			srcSet: srcSet || queueItem?.srcSet,
			format: preview?.format,
			variants: variants.map((variant) => ({
				label: variant.label,
				format: variant.format,
				width: variant.width,
				height: variant.height,
				size: variant.size,
				url: variant.url
			}))
		};

		const _win = window as Window & { __imagePreviewMap?: Record<string, string | undefined> };
		if (!_win.__imagePreviewMap) _win.__imagePreviewMap = {};
		if (preview?.url) _win.__imagePreviewMap[id] = preview.url;
		const _sourceWin = window as Window & {
			__imageOptimizeSourceMap?: Record<string, string | undefined>;
		};
		if (!_sourceWin.__imageOptimizeSourceMap) _sourceWin.__imageOptimizeSourceMap = {};
		_sourceWin.__imageOptimizeSourceMap[id] = optimizationSource;

		const imageType = editorView.state.schema.nodes.image;
		if (!imageType) return;

		let tr = editorView.state.tr;
		let changed = false;
		editorView.state.doc.descendants((node, pos) => {
			if (node.type !== imageType) return;
			if (node.attrs.src !== id) return;
			tr = tr.setNodeMarkup(pos, undefined, {
				...node.attrs,
				previewSrc: preview?.url ?? node.attrs.previewSrc ?? null,
				srcSet: srcSet || null,
				quality
			});
			changed = true;
		});

		if (changed) {
			tr.setMeta('addToHistory', false);
			editorView.dispatch(tr);
		}

		const storageMode = imageOptions.storage ?? 'auto';
		const uploader = imageOptions.upload;
		const shouldAttemptUpload =
			storageMode !== 'local' && typeof uploader === 'function';

		if (shouldAttemptUpload) {
			const uploadPayload: ImageUploadPayload = {
				id,
				file: sourceFile,
				queueItem: imageQueue[id],
				variants: uploadVariants
			};

			try {
				const uploadResult = await uploader(uploadPayload);
				if (uploadResult) {
					const nextSrc = uploadResult.src ?? id;
					const nextPreviewUrl = uploadResult.previewUrl ?? preview?.url ?? imageQueue[id]?.previewUrl;
					const nextSrcSet = uploadResult.srcSet ?? srcSet ?? imageQueue[id]?.srcSet;

					const uploadedEntry = {
						...imageQueue[id],
						id: nextSrc,
						previewUrl: nextPreviewUrl,
						srcSet: nextSrcSet
					};

					imageQueue[id] = uploadedEntry;
					if (nextSrc !== id) {
						imageQueue[nextSrc] = uploadedEntry;
					}

					const _win = window as Window & { __imagePreviewMap?: Record<string, string | undefined> };
					if (!_win.__imagePreviewMap) _win.__imagePreviewMap = {};
					if (nextPreviewUrl) _win.__imagePreviewMap[nextSrc] = nextPreviewUrl;

					const imageType = editorView.state.schema.nodes.image;
					if (imageType) {
						let uploadTr = editorView.state.tr;
						let uploadChanged = false;
						editorView.state.doc.descendants((node, pos) => {
							if (node.type !== imageType) return;
							if (node.attrs.src !== id) return;
							uploadTr = uploadTr.setNodeMarkup(pos, undefined, {
								...node.attrs,
								src: nextSrc,
								previewSrc: nextPreviewUrl ?? null,
								srcSet: nextSrcSet ?? null,
								quality
							});
							uploadChanged = true;
						});

						if (uploadChanged) {
							uploadTr.setMeta('addToHistory', false);
							editorView.dispatch(uploadTr);
						}
					}
				}
			} catch {
				// upload failures fall back to local optimized variants
			}
		}
	}

	$effect(() => {
		if (!editorView || initializing) return;

		if (docId !== lastAppliedDocId) {
			editorView.setMarkdown?.(markdown);
			lastAppliedDocId = docId;
			if (viewMode === 'markdown') {
				refreshMarkdownToolbarState();
			}
			return;
		}

		updateEditorFromMarkdown(markdown);
		if (viewMode !== 'markdown') return;
		refreshMarkdownToolbarState();
	});

	onMount(async () => {
		if (!isBrowser || !editorRef) return;

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

		// Restore autosaved draft BEFORE creating the editor so we only parse once.
		if (editable) {
			const saved = autoSavePlugin.restore('markdown-editor', docId);
			if (saved) {
				markdown = saved.markdown;
				if (saved.queue) {
					const referencedIds = extractReferencedImageIds(saved.markdown);

					for (const key of Object.keys(imageQueue)) {
						delete imageQueue[key];
					}

					for (const item of saved.queue) {
						if (!item?.id || !referencedIds[item.id]) continue;
						imageQueue[item.id] = item;
					}
				}
			}
		}

		editorView = setupProseMirror(
			editorRef,
			markdown,
			imageQueue,
			docId,
			editable,
			allowHtml,
			imageOptions
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

		// Handle image replacement events fired by ImageNodeView
		const onImageReplaced = (e: Event) => {
			const { oldId, newId, file, previewUrl } = (e as CustomEvent).detail as {
				oldId: string;
				newId: string;
				file: File;
				previewUrl: string;
			};
			// Remove old entry from queue if it was local
			delete imageQueue[oldId];
			// Add new entry
			imageQueue[newId] = {
				id: newId,
				file,
				originalFile: file,
				previewUrl,
				optimizationSource: 'original-fallback'
			};

			const _sourceWin = window as Window & {
				__imageOptimizeSourceMap?: Record<string, string | undefined>;
			};
			if (!_sourceWin.__imageOptimizeSourceMap) _sourceWin.__imageOptimizeSourceMap = {};
			delete _sourceWin.__imageOptimizeSourceMap[oldId];
			_sourceWin.__imageOptimizeSourceMap[newId] = 'pending';
		};
		editorRef.addEventListener('pm-image-replaced', onImageReplaced);

		const onImageOptimizeRequest = (e: Event) => {
			if (imageOptions.enableOptimization !== true) return;
			const { id, quality, widths, primaryFormat } = (e as CustomEvent).detail as {
				id: string;
				quality?: number;
				widths?: number[];
				primaryFormat?: string;
			};
			void optimiseImageById(
				id,
				typeof quality === 'number' ? quality : (imageOptions.quality ?? DEFAULT_SHARPLESS_QUALITY),
				Array.isArray(widths) && widths.length > 0 ? widths : [480, 1024, 1920],
				primaryFormat || imageOptions.preferredFormat || 'image/webp'
			);
		};
		editorRef.addEventListener('pm-image-optimize-request', onImageOptimizeRequest);
		const removePmImageReplacedListener = () => {
			editorRef?.removeEventListener('pm-image-replaced', onImageReplaced);
			editorRef?.removeEventListener('pm-image-optimize-request', onImageOptimizeRequest);
		};

		removePmUpdatedListener = () => {
			editorRef?.removeEventListener('pm-updated', onPmUpdated);
			removePmImageReplacedListener();
		};
		initializing = false;
		updateToolbarState();
	});

	function onAction(action: ToolbarAction): void {
		if (viewMode === 'markdown') {
			applyMarkdownAction(action);
			return;
		}

		if (!editorView) return;

		handleAction(action);
		updateToolbarState();
	}

	function switchViewMode(nextMode: EditorViewMode): void {
		if (viewMode === nextMode) return;

		if (nextMode === 'markdown') {
			updateMarkdownFromEditorImmediate();
			viewMode = 'markdown';
			Promise.resolve().then(() => {
				syncMarkdownSelection();
				refreshMarkdownToolbarState();
			});
			return;
		}

		viewMode = 'wysiwyg';
		Promise.resolve().then(() => editorView?.focus());
	}

	function editorHasFocusWithin(): boolean {
		if (!isBrowser || !editorShellRef) return false;
		const active = document.activeElement;
		return active instanceof Node ? editorShellRef.contains(active) : false;
	}

	function handleWindowKeyDown(event: KeyboardEvent): void {
		const isModifier = event.metaKey || event.ctrlKey;
		if (!isModifier || !event.shiftKey || event.altKey) return;
		if (event.key.toLowerCase() !== 'm') return;
		if (!editorHasFocusWithin()) return;

		event.preventDefault();
		switchViewMode(viewMode === 'wysiwyg' ? 'markdown' : 'wysiwyg');
	}

	onDestroy(() => {
		removePmUpdatedListener?.();
		editorView?.destroy();
		setEditorView(null);
	});
</script>

<svelte:window onkeydown={handleWindowKeyDown} />

<section bind:this={editorShellRef} class="markdown-editor">
	{#if toolbar}
		<EditorToolbar
			{onAction}
			onViewModeChange={switchViewMode}
			activeMarks={viewMode === 'markdown' ? markdownActiveMarks : activeMarks}
			activeBlocks={viewMode === 'markdown' ? markdownActiveBlocks : activeBlocks}
			commandStates={viewMode === 'markdown' ? markdownCommandStates : commandStates}
			{allowHtml}
			{viewMode}
		/>
	{/if}

	<div bind:this={editorRef} class="pm-editor-host" hidden={viewMode !== 'wysiwyg'}></div>

	{#if viewMode === 'markdown'}
		<textarea
			bind:this={markdownSourceRef}
			class="pm-markdown-source"
			bind:value={markdown}
			oninput={syncMarkdownSelection}
			onclick={syncMarkdownSelection}
			onkeyup={syncMarkdownSelection}
			onmouseup={syncMarkdownSelection}
			onselect={syncMarkdownSelection}
			onfocus={syncMarkdownSelection}
			placeholder="Write Markdown…"
			spellcheck="false"
			readonly={!editable}
		></textarea>
	{/if}
</section>