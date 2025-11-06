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
import { autoSavePlugin } from './plugins/autoSavePlugin.js';
import { TextSelection } from 'prosemirror-state';

export function setupProseMirror(
	element: HTMLElement,
	initialMarkdown = '',
	imageQueue: { id: string; file: File; previewUrl?: string }[] = [],
	docId = 'default',
	editable = true
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
			imageDropPlugin(imageQueue),
			linkClickPlugin(),
			codeMirrorBlockPlugin(),
			markdownKeymap(schema),
			autoSavePlugin(imageQueue, { docId }),
			keymap(baseKeymap)
		]
	});

	interface ExtendedEditorView extends EditorView {
		getMarkdown: () => string;
		setMarkdown: (md: string) => void;
	}

	const view: ExtendedEditorView = new EditorView(element, {
		state,
		editable: () => editable,
		dispatchTransaction: (tr) => {
			const newState = view.state.apply(tr);
			view.updateState(newState);
		}
	}) as ExtendedEditorView;

	view.getMarkdown = () => serializer.serialize(view.state.doc);

	view.setMarkdown = (md: string) => {
		const newDoc = parser.parse(md);
		const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, newDoc.content);
		view.dispatch(tr);
	};

	// =====================================================================
	// 🧩 Interactive checkbox click handler (preserves cursor position)
	// =====================================================================
	element.addEventListener('click', (event) => {
		const target = event.target as HTMLElement;
		if (!target.matches('.pm-task-checkbox')) return;
		if (!editable) return;

		const li = target.closest('li[data-checked]');
		if (!li) return;

		const pos = view.posAtDOM(li, 0);
		if (pos == null) return;

		const node = view.state.doc.nodeAt(pos);
		if (!node || node.type.name !== 'list_item') return;

		// Save current selection before toggling
		const { from } = view.state.selection;

		const isChecked = !!node.attrs.checked;
		const tr = view.state.tr.setNodeMarkup(pos, node.type, {
			...node.attrs,
			checked: !isChecked
		});

		// ✅ Restore cursor position and prevent scroll jump
		tr.setSelection(TextSelection.near(tr.doc.resolve(from)));
		view.dispatch(tr);
	});
	// =====================================================================

	return view;
}
