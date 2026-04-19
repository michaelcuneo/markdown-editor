import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode, Schema } from 'prosemirror-model';
import { Transform } from 'prosemirror-transform';
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
import { ImageNodeView } from './plugins/imageNodeView.js';
import type { MarkdownParser, MarkdownSerializer } from 'prosemirror-markdown';
import type { MarkdownImageOptions } from '../types/index.js';

type ImageQueueItem = {
	id: string;
	file?: File;
	previewUrl?: string;
	srcSet?: string;
	quality?: number;
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

function buildPreviewMap(imageQueue: Record<string, ImageQueueItem>): Map<string, string> {
	const previewMap = new Map<string, string>();
	for (const item of Object.values(imageQueue)) {
		if (item.previewUrl) previewMap.set(item.id, item.previewUrl);
	}
	if (typeof window !== 'undefined') {
		const registry = (
			window as Window & {
				__imagePreviewMap?: Record<string, string | undefined>;
			}
		).__imagePreviewMap;
		if (registry) {
			for (const [id, url] of Object.entries(registry)) {
				if (url) previewMap.set(id, url);
			}
		}
	}
	return previewMap;
}

function hydrateImagePreviewAttrs(
	doc: PMNode,
	schema: Schema,
	imageQueue: Record<string, ImageQueueItem>
): PMNode {
	const imageNodeType = schema.nodes.image;
	if (!imageNodeType) return doc;

	const previewMap = buildPreviewMap(imageQueue);
	if (previewMap.size === 0) return doc;

	const tr = new Transform(doc);
	let changed = false;

	doc.descendants((node, pos) => {
		if (node.type !== imageNodeType) return;

		const src = node.attrs.src;
		if (typeof src !== 'string' || src.length === 0) return;
		const queueItem = imageQueue[src];

		const previewSrc = previewMap.get(src);
		const nextPreviewSrc = previewSrc ?? queueItem?.previewUrl ?? null;
		const nextSrcSet = queueItem?.srcSet ?? null;
		const nextQuality = queueItem?.quality ?? null;

		const unchanged =
			node.attrs.previewSrc === nextPreviewSrc &&
			node.attrs.srcSet === nextSrcSet &&
			node.attrs.quality === nextQuality;

		if (unchanged) return;

		tr.setNodeMarkup(pos, undefined, {
			...node.attrs,
			previewSrc: nextPreviewSrc,
			srcSet: nextSrcSet,
			quality: nextQuality
		});
		changed = true;
	});

	return changed ? tr.doc : doc;
}

function createEditorBundle(
	initialMarkdown: string,
	imageQueue: Record<string, ImageQueueItem>,
	docId: string,
	allowHtml: boolean,
	editable: boolean,
	imageOptions: MarkdownImageOptions
): EditorBundle {
	const schema = createTaskListSchema();
	const { parser, serializer } = createMarkdownTaskSupport(schema, { allowHtml });

	const doc = initialMarkdown.trim()
		? parser.parse(initialMarkdown)
		: schema.topNodeType.createAndFill();

	if (!doc) {
		throw new Error('Failed to create initial ProseMirror document');
	}

	const hydratedDoc = hydrateImagePreviewAttrs(doc, schema, imageQueue);

	const state = EditorState.create({
		doc: hydratedDoc,
		schema,
		plugins: [
			history(),
			markdownInputRules(schema),
			wysiwymPlugin(schema),
			taskTogglePlugin(),
			markdownEnterPlugin(schema),
			markdownBackspacePlugin(schema),
			imageDropPlugin(imageQueue, imageOptions),
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
	imageQueue: Record<string, ImageQueueItem> = {},
	docId = 'default',
	editable = true,
	allowHtml = false,
	imageOptions: MarkdownImageOptions = {}
): ProseMirrorEditorView {
	const { state, parser, serializer } = createEditorBundle(
		initialMarkdown,
		imageQueue,
		docId,
		allowHtml,
		editable,
		imageOptions
	);

	const view: ProseMirrorEditorView = new EditorView(element, {
		state,
		editable: () => editable,
		nodeViews: {
			image: (node, editorView, getPos) =>
				new ImageNodeView(node, editorView, getPos as () => number | undefined, {
					showOptimizationControls: imageOptions.enableOptimization === true
				})
		},
		dispatchTransaction(tr) {
			const newState = view.state.apply(tr);
			view.updateState(newState);
		}
	}) as ProseMirrorEditorView;

	view.getMarkdown = () => serializer.serialize(view.state.doc);

	view.setMarkdown = (markdown: string) => {
		const parsedDoc = parser.parse(markdown);
		const newDoc = hydrateImagePreviewAttrs(parsedDoc, view.state.schema, imageQueue);

		// Replace only the document content so plugin state (history, decorations, etc.)
		// is preserved and NodeViews are not needlessly destroyed and recreated.
		const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, newDoc.content);
		tr.setMeta('addToHistory', false);
		view.dispatch(tr);
	};

	return view;
}
