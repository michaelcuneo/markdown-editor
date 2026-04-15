import { keymap } from 'prosemirror-keymap';
import {
	toggleMark,
	setBlockType,
	chainCommands,
	deleteSelection,
	joinBackward,
	selectNodeBackward,
	splitBlock,
	liftEmptyBlock,
	newlineInCode,
	exitCode,
	wrapIn
} from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import { liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list';
import { goToNextCell } from 'prosemirror-tables';
import type { Schema } from 'prosemirror-model';
import type { Plugin, EditorState, Transaction } from 'prosemirror-state';

type KeyCommand = (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean;

export function markdownKeymap(schema: Schema): Plugin {
	const bindings: Record<string, KeyCommand> = {};

	// --- Editing basics ---
	if (schema.nodes.list_item) {
		bindings['Enter'] = chainCommands(
			newlineInCode,
			splitListItem(schema.nodes.list_item),
			splitBlock
		);
	} else {
		bindings['Enter'] = chainCommands(newlineInCode, splitBlock);
	}

	bindings['Shift-Enter'] = chainCommands(
		newlineInCode,
		(state: EditorState, dispatch?: (tr: Transaction) => void) => {
			const br = schema.nodes.hard_break;
			if (!br) return false;

			dispatch?.(state.tr.replaceSelectionWith(br.create()).scrollIntoView());
			return true;
		}
	);

	bindings['Mod-Enter'] = exitCode;

	bindings['Backspace'] = chainCommands(
		deleteSelection,
		joinBackward,
		liftEmptyBlock,
		selectNodeBackward
	);

	// --- Undo / Redo ---
	bindings['Mod-z'] = undo;
	bindings['Mod-Shift-z'] = redo;
	bindings['Mod-y'] = redo;

	// --- Inline formatting ---
	if (schema.marks.strong) {
		bindings['Mod-b'] = toggleMark(schema.marks.strong);
	}

	if (schema.marks.em) {
		bindings['Mod-i'] = toggleMark(schema.marks.em);
	}

	if (schema.marks.strikethrough) {
		bindings['Mod-Shift-x'] = toggleMark(schema.marks.strikethrough);
	}

	if (schema.marks.code) {
		bindings['Mod-`'] = toggleMark(schema.marks.code);
	}

	// --- Links ---
	if (schema.marks.link) {
		bindings['Mod-k'] = (state: EditorState, dispatch?: (tr: Transaction) => void) => {
			const { from, to } = state.selection;
			if (from === to) return false;

			let url = prompt('Enter link URL:');
			if (!url) return false;

			url = url.trim();
			if (!url) return false;

			if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) {
				url = 'https://' + url;
			}

			return toggleMark(schema.marks.link!, { href: url })(state, dispatch);
		};
	}

	// --- Headings ---
	if (schema.nodes.heading) {
		bindings['Mod-Alt-1'] = setBlockType(schema.nodes.heading, { level: 1 });
		bindings['Mod-Alt-2'] = setBlockType(schema.nodes.heading, { level: 2 });
		bindings['Mod-Alt-3'] = setBlockType(schema.nodes.heading, { level: 3 });
	}

	// --- Lists ---
	if (schema.nodes.list_item) {
		bindings['Tab'] = chainCommands(goToNextCell(1), sinkListItem(schema.nodes.list_item));
		bindings['Shift-Tab'] = chainCommands(goToNextCell(-1), liftListItem(schema.nodes.list_item));

		// Optional alternative shortcuts if you still want them
		bindings['Mod-]'] = sinkListItem(schema.nodes.list_item);
		bindings['Mod-['] = liftListItem(schema.nodes.list_item);
	}

	// --- Blockquote ---
	if (schema.nodes.blockquote) {
		bindings['Mod-Shift-b'] = wrapIn(schema.nodes.blockquote);
	}

	// --- Code blocks ---
	if (schema.nodes.code_block && schema.nodes.paragraph) {
		bindings['Mod-Alt-c'] = (state: EditorState, dispatch?: (tr: Transaction) => void) => {
			const { code_block, paragraph } = schema.nodes;
			if (!code_block || !paragraph) return false;

			const isCodeBlock = state.selection.$from.parent.type === code_block;
			return setBlockType(isCodeBlock ? paragraph : code_block)(state, dispatch);
		};
	}

	// --- Horizontal rule ---
	if (schema.nodes.horizontal_rule) {
		bindings['Mod-Shift--'] = (state: EditorState, dispatch?: (tr: Transaction) => void) => {
			const hr = schema.nodes.horizontal_rule;
			if (!hr) return false;

			dispatch?.(state.tr.replaceSelectionWith(hr.create()).scrollIntoView());
			return true;
		};
	}

	return keymap(bindings);
}
