import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { tableEditing } from 'prosemirror-tables';

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
import { autoSavePlugin } from './plugins/autoSavePlugin.js';
import type { MarkdownParser, MarkdownSerializer } from 'prosemirror-markdown';

type ImageQueueItem = {
	id: string;
	file: File;
	previewUrl?: string;
};

export interface ProseMirrorEditorView extends EditorView {
	getMarkdown(): string;
	setMarkdown(markdown: string): void;
}

type EditorBundle = {
	state: EditorState;
	parser: MarkdownParser;
	serializer: MarkdownSerializer;
};

function createEditorBundle(
	initialMarkdown: string,
	imageQueue: ImageQueueItem[],
	docId: string,
	allowHtml: boolean,
	editable: boolean
): EditorBundle {
	const schema = createTaskListSchema();
	const { parser, serializer } = createMarkdownTaskSupport(schema, { allowHtml });

	const doc = initialMarkdown.trim()
		? parser.parse(initialMarkdown)
		: schema.topNodeType.createAndFill();

	if (!doc) {
		throw new Error('Failed to create initial ProseMirror document');
	}

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
			imageDropPlugin(imageQueue),
			linkClickPlugin(),
			codeMirrorBlockPlugin(),
			tableEditing(),
			markdownKeymap(schema),
			...(editable ? [autoSavePlugin(imageQueue, { docId })] : []),
			keymap(baseKeymap)
		]
	});

	return { state, parser, serializer };
}

export function setupProseMirror(
	element: HTMLElement,
	initialMarkdown = '',
	imageQueue: ImageQueueItem[] = [],
	docId = 'default',
	editable = true,
	allowHtml = false
): ProseMirrorEditorView {
	const { state, parser, serializer } = createEditorBundle(
		initialMarkdown,
		imageQueue,
		docId,
		allowHtml,
		editable
	);

	const view: ProseMirrorEditorView = new EditorView(element, {
		state,
		editable: () => editable,
		dispatchTransaction(tr) {
			const newState = view.state.apply(tr);
			view.updateState(newState);
		}
	}) as ProseMirrorEditorView;

	view.getMarkdown = () => serializer.serialize(view.state.doc);

	view.setMarkdown = (markdown: string) => {
		const newDoc = parser.parse(markdown);

		const newState = EditorState.create({
			doc: newDoc,
			schema: view.state.schema,
			plugins: view.state.plugins
		});

		view.updateState(newState);
	};

	return view;
}
