import { keymap } from 'prosemirror-keymap';
import {
	toggleMark,
	setBlockType,
	chainCommands,
	splitBlock,
	liftEmptyBlock,
	newlineInCode,
	exitCode,
	wrapIn
} from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import { liftListItem, sinkListItem } from 'prosemirror-schema-list'; // ✅ FIXED
import type { Schema } from 'prosemirror-model';
import type { Plugin, EditorState, Transaction } from 'prosemirror-state';

/**
 * Comprehensive Markdown-style keyboard shortcuts
 */
export function markdownKeymap(schema: Schema): Plugin {
	const bindings: Record<
		string,
		(state: EditorState, dispatch?: (tr: Transaction) => void) => boolean
	> = {};

	// --- Editing basics ---
	bindings['Enter'] = chainCommands(newlineInCode, splitBlock);
	bindings['Shift-Enter'] = (state: EditorState, dispatch?: (tr: Transaction) => void) => {
		const br = schema.nodes.hard_break;
		if (!br) return false;
		dispatch?.(state.tr.replaceSelectionWith(br.create()).scrollIntoView());
		return true;
	};
	bindings['Mod-Enter'] = exitCode;
	bindings['Backspace'] = liftEmptyBlock;

	// --- Undo/Redo ---
	bindings['Mod-z'] = undo;
	bindings['Mod-Shift-z'] = redo;
	bindings['Mod-y'] = redo; // Windows-friendly redo

	// --- Inline formatting ---
	if (schema.marks.strong) bindings['Mod-b'] = toggleMark(schema.marks.strong);
	if (schema.marks.em) bindings['Mod-i'] = toggleMark(schema.marks.em);
	if ('strikethrough' in schema.marks)
		bindings['Mod-Shift-x'] = toggleMark(schema.marks.strikethrough);
	if (schema.marks.code) bindings['Mod-`'] = toggleMark(schema.marks.code);

	// --- Links ---
	if (schema.marks.link) {
		bindings['Mod-k'] = (state: EditorState, dispatch?: (tr: Transaction) => void) => {
			const url = prompt('Enter link URL:');
			if (!url) return false;
			const mark = schema.marks.link?.create({ href: url });
			if (!mark) return false;
			const { from, to } = state.selection;
			if (from === to) return false;
			dispatch?.(state.tr.addMark(from, to, mark).scrollIntoView());
			return true;
		};
	}

	// --- Headings ---
	if (schema.nodes.heading) {
		bindings['Mod-Alt-1'] = setBlockType(schema.nodes.heading, { level: 1 });
		bindings['Mod-Alt-2'] = setBlockType(schema.nodes.heading, { level: 2 });
		bindings['Mod-Alt-3'] = setBlockType(schema.nodes.heading, { level: 3 });
	}

	// --- Lists ---
	if (schema.nodes.bullet_list && schema.nodes.list_item) {
		bindings['Mod-]'] = sinkListItem(schema.nodes.list_item);
		bindings['Mod-['] = liftListItem(schema.nodes.list_item);
	}

	// --- Blockquote ---
	if (schema.nodes.blockquote) {
		bindings['Mod-Shift-b'] = wrapIn(schema.nodes.blockquote);
	}

	// --- Code blocks ---
	if (schema.nodes.code_block) {
		bindings['Mod-Alt-c'] = setBlockType(schema.nodes.code_block);
	}

	return keymap(bindings);
}
