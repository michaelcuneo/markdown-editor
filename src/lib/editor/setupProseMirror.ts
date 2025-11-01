import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Schema } from 'prosemirror-model';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';

import { createTaskListSchema } from './schema/tasklistSchema.js';
import { createMarkdownTaskSupport } from './tasks/markdownTaskSupport.js';
import { taskTogglePlugin } from './plugins/taskTogglePlugin.js';
import { markdownInputRules } from './rules/markdownInputRules.js';
import { markdownKeymap } from './keymap/markdownKeymap.js';
import { wysiwymPlugin } from './plugins/wysiwymPlugin.js';
import { markdownEnterPlugin } from './plugins/markdownEnterPlugin.js';
import { linkClickPlugin } from './plugins/linkClickPlugin.js';

export function setupProseMirror(element: HTMLElement, initialMarkdown = ''): EditorView {
	const schema: Schema = createTaskListSchema();
	const { parser, serializer } = createMarkdownTaskSupport(schema);

	const doc = initialMarkdown.trim()
		? parser.parse(initialMarkdown)
		: schema.topNodeType.createAndFill() || undefined;

	const state = EditorState.create({
		doc,
		schema,
		plugins: [
			history(),
			markdownInputRules(schema),
			wysiwymPlugin(schema),
			taskTogglePlugin(),
			markdownEnterPlugin(schema),
			markdownKeymap(schema),
			linkClickPlugin(),
			keymap(baseKeymap)
		]
	});

	const view = new EditorView(element, {
		state,
		dispatchTransaction(tr) {
			const newState = view.state.apply(tr);
			view.updateState(newState);
		}
	});

	// --- Expose Markdown helpers ---
	interface ExtendedView extends EditorView {
		getMarkdown: () => string;
		setMarkdown: (md: string) => void;
	}
	const extended = view as ExtendedView;

	extended.getMarkdown = () => serializer.serialize(view.state.doc);
	extended.setMarkdown = (md: string) => {
		const newDoc = parser.parse(md);
		const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, newDoc.content);
		view.dispatch(tr);
	};

	return view;
}
