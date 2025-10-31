// src/lib/editor/commands.ts
import { toggleMark, setBlockType, wrapIn } from 'prosemirror-commands';
import { wrapInList } from 'prosemirror-schema-list';
import type { EditorView } from 'prosemirror-view';
import type { Schema } from 'prosemirror-model';

export function bindToolbarCommands(view: EditorView, schema: Schema) {
	const { marks, nodes } = schema;

	return {
		bold: () => toggleMark(marks.strong)(view.state, view.dispatch),
		italic: () => toggleMark(marks.em)(view.state, view.dispatch),
		quote: () => wrapIn(nodes.blockquote)(view.state, view.dispatch),
		h1: () => setBlockType(nodes.heading, { level: 1 })(view.state, view.dispatch),
		h2: () => setBlockType(nodes.heading, { level: 2 })(view.state, view.dispatch),
		ul: () => wrapInList(nodes.bullet_list)(view.state, view.dispatch),
		ol: () => wrapInList(nodes.ordered_list)(view.state, view.dispatch),
		codeblock: () => setBlockType(nodes.code_block)(view.state, view.dispatch)
	} as const;
}
