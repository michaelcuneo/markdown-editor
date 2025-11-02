import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';

import { createMarkdownSchema } from './schema/markdownSchema.js';
import { createMarkdownTaskSupport } from './tasks/markdownTaskSupport.js';
import { taskTogglePlugin } from './plugins/taskTogglePlugin.js';
import { markdownInputRules } from './rules/markdownInputRules.js';
import { markdownKeymap } from './keymap/markdownKeymap.js';
import { wysiwymPlugin } from './plugins/wysiwymPlugin.js';
import { markdownEnterPlugin } from './plugins/markdownEnterPlugin.js';
import { linkClickPlugin } from './plugins/linkClickPlugin.js';
import { codeMirrorBlockPlugin } from './plugins/codemirrorBlockPlugin.js';
import { markdownBackspacePlugin } from './plugins/markdownBackspacePlugin.js';
import { markdownTabPlugin } from './plugins/markdownTabPlugin.js';
import { markdownDeletePlugin } from './plugins/markdownDeletePlugin.js';
import { markdownArrowPlugin } from './plugins/markdownArrowPlugin.js';

export function setupProseMirror(element: HTMLElement, initialMarkdown = ''): EditorView {
	const schema = createMarkdownSchema();
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
			markdownBackspacePlugin(schema),
			markdownTabPlugin(schema),
			markdownArrowPlugin(schema),
			markdownDeletePlugin(schema),
			markdownKeymap(schema),
			linkClickPlugin(),
			codeMirrorBlockPlugin(),
			keymap(baseKeymap)
		]
	});

	const view = new EditorView(element, {
		state,
		dispatchTransaction(tr) {
			const newState = view.state.apply(tr);
			view.updateState(newState);
		}
	}) as EditorView & {
		getMarkdown: () => string;
		setMarkdown: (md: string) => void;
	};

	view.getMarkdown = () => serializer.serialize(view.state.doc);
	view.setMarkdown = (md: string) => {
		const newDoc = parser.parse(md);
		const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, newDoc.content);
		view.dispatch(tr);
	};

	return view;
}
