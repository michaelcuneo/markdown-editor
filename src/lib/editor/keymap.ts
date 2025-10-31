import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark, setBlockType, wrapIn } from 'prosemirror-commands';
import { wrapInList } from 'prosemirror-schema-list';
import { undo, redo } from 'prosemirror-history';
import type { Schema } from 'prosemirror-model';
import type { Command } from 'prosemirror-state';

/**
 * Build custom keyboard shortcuts for the Markdown editor.
 */
export function buildKeymap(schema: Schema) {
	const { marks, nodes } = schema;

	const bind: Record<string, Command> = {};

	// === Formatting ===
	if (marks.strong) bind['Mod-b'] = toggleMark(marks.strong);
	if (marks.em) bind['Mod-i'] = toggleMark(marks.em);
	if (marks.code) bind['Mod-`'] = toggleMark(marks.code);

	// === Undo / Redo ===
	bind['Mod-z'] = undo;
	bind['Shift-Mod-z'] = redo;

	// === Headings ===
	if (nodes.heading) {
		bind['Shift-Ctrl-1'] = setBlockType(nodes.heading, { level: 1 });
		bind['Shift-Ctrl-2'] = setBlockType(nodes.heading, { level: 2 });
		bind['Shift-Ctrl-3'] = setBlockType(nodes.heading, { level: 3 });
	}

	// === Lists ===
	if (nodes.bullet_list) bind['Shift-Ctrl-8'] = wrapInList(nodes.bullet_list);
	if (nodes.ordered_list) bind['Shift-Ctrl-7'] = wrapInList(nodes.ordered_list);

	// === Quote ===
	if (nodes.blockquote) bind['Mod->'] = wrapIn(nodes.blockquote);

	// === Code block ===
	if (nodes.code_block) bind['Shift-Ctrl-`'] = setBlockType(nodes.code_block);

	// === Paragraph reset ===
	if (nodes.paragraph) bind['Shift-Ctrl-0'] = setBlockType(nodes.paragraph);

	// === Horizontal rule ===
	if (nodes.horizontal_rule)
		bind['Mod-_'] = (state, dispatch) => {
			if (dispatch) dispatch(state.tr.replaceSelectionWith(nodes.horizontal_rule.create()));
			return true;
		};

	// Return combined keymaps
	return [
		keymap(bind), // our custom bindings
		keymap(baseKeymap) // default PM navigation / delete / etc.
	];
}
