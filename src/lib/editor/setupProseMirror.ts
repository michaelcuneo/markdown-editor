import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { createTaskListSchema } from './schema/tasklistSchema.js';
import { createMarkdownTaskSupport } from './tasks/markdownTaskSupport.js';
import { markdownInputRules } from './rules/markdownInputRules.js';
import { markdownKeymap } from './keymap/markdownKeymap.js';
import { wysiwymPlugin } from './plugins/wysiwymPlugin.js';
import { taskTogglePlugin } from './plugins/taskTogglePlugin.js';
import { markdownEnterPlugin } from './plugins/markdownEnterPlugin.js';
import { markdownBackspacePlugin } from './plugins/markdownBackspacePlugin.js';
import { imageDropPlugin } from './plugins/imageDropPlugin.js';
import { codeMirrorBlockPlugin } from './plugins/codemirrorBlockPlugin.js';
import { linkClickPlugin } from './plugins/linkClickPlugin.js';

export function setupProseMirror(
	element: HTMLElement,
	initialMarkdown = '',
	imageQueue: { id: string; file: File; previewUrl?: string }[] = []
): EditorView {
	const schema = createTaskListSchema();
	const { parser, serializer } = createMarkdownTaskSupport(schema);

	const doc = initialMarkdown.trim()
		? parser.parse(initialMarkdown)
		: schema.topNodeType.createAndFill()!;

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
			imageDropPlugin(imageQueue), // ✅ added
			linkClickPlugin(),
			codeMirrorBlockPlugin(),
			markdownKeymap(schema),
			keymap(baseKeymap)
		]
	});

	interface ExtendedEditorView extends EditorView {
		getMarkdown: () => string;
		setMarkdown: (md: string) => void;
	}

	const view: ExtendedEditorView = new EditorView(element, { state }) as ExtendedEditorView;
	view.getMarkdown = () => serializer.serialize(view.state.doc);
	view.setMarkdown = (md: string) => {
		const newDoc = parser.parse(md);
		const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, newDoc.content);
		view.dispatch(tr);
	};
	return view;
}
