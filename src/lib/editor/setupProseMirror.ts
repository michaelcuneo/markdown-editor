// src/lib/editor/setupProseMirror.ts
import { EditorState, Plugin, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import {
	MarkdownParser,
	MarkdownSerializer,
	defaultMarkdownParser,
	defaultMarkdownSerializer
} from 'prosemirror-markdown';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: false, linkify: true });
const schema = defaultMarkdownParser.schema;
const parser = new MarkdownParser(schema, md, defaultMarkdownParser.tokens);
const serializer = new MarkdownSerializer(
	defaultMarkdownSerializer.nodes,
	defaultMarkdownSerializer.marks
);

export function setupProseMirror(
	target: HTMLElement,
	initialMarkdown = '',
	onChange?: (markdown: string) => void
): EditorView {
	const doc = parser.parse(initialMarkdown);

	const state = EditorState.create({
		doc,
		schema,
		plugins: [
			history(),
			keymap(baseKeymap),
			new Plugin({
				appendTransaction(_, __, ns) {
					onChange?.(serializer.serialize(ns.doc).trim());
					return null;
				}
			})
		]
	});

	const view = new EditorView(target, {
		state,
		dispatchTransaction(tr: Transaction) {
			const ns = view.state.apply(tr);
			view.updateState(ns);
			onChange?.(serializer.serialize(ns.doc).trim());
		}
	});

	return view;
}
