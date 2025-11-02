import type { EditorView } from 'prosemirror-view';
import type { EditorState, Command } from 'prosemirror-state';
import type { ToolbarAction } from '../../types/index.js';
import { undo, redo } from 'prosemirror-history';
import { toggleMark, setBlockType, wrapIn } from 'prosemirror-commands';
import { defaultMarkdownSerializer, defaultMarkdownParser } from 'prosemirror-markdown';

let editorView: EditorView | null = null;

export function setEditorView(view: EditorView | null): void {
	editorView = view;
}

export function getEditorView(): EditorView | null {
	return editorView;
}

function runCommand(command: Command, state: EditorState, view: EditorView): void {
	if (!command(state, view.dispatch, view)) {
		console.warn('[ProseMirror] Command not executed:', command);
	}
}

export function exportMarkdown(): string | null {
	if (!editorView) return null;
	return defaultMarkdownSerializer.serialize(editorView.state.doc);
}

export function importMarkdown(markdown: string): void {
	if (!editorView) return;
	const { state } = editorView;
	const doc = defaultMarkdownParser.parse(markdown);
	const tr = state.tr.replaceWith(0, state.doc.content.size, doc.content);
	editorView.dispatch(tr.scrollIntoView());
}

/**
 * Handle toolbar actions (GFM-style)
 */
export function handleAction(action: ToolbarAction): void {
	if (!editorView) return;

	const { state } = editorView;
	const { schema } = state;
	const safeRun = (cmd: Command) => runCommand(cmd, state, editorView!);

	switch (action) {
		// --- Inline marks ---
		case 'bold':
			safeRun(toggleMark(schema.marks.strong));
			break;

		case 'italic':
			safeRun(toggleMark(schema.marks.em));
			break;

		case 'strike':
			if (schema.marks.strikethrough) safeRun(toggleMark(schema.marks.strikethrough));
			break;

		case 'link': {
			const linkMark = schema.marks.link;
			if (!linkMark) break;
			let url = prompt('Enter URL:');
			if (url) {
				if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
				safeRun(toggleMark(linkMark, { href: url }));
			}
			break;
		}

		// --- Block types ---
		case 'h1':
			safeRun(setBlockType(schema.nodes.heading, { level: 1 }));
			break;

		case 'h2':
			safeRun(setBlockType(schema.nodes.heading, { level: 2 }));
			break;

		case 'quote':
			if (schema.nodes.blockquote) safeRun(wrapIn(schema.nodes.blockquote));
			break;

		case 'codeblock':
			if (schema.nodes.code_block) safeRun(setBlockType(schema.nodes.code_block));
			break;

		case 'hr': {
			const { schema } = state;
			if (schema.nodes.horizontal_rule) {
				const node = schema.nodes.horizontal_rule.create();
				const tr = state.tr.replaceSelectionWith(node).scrollIntoView();
				editorView.dispatch(tr);
			}
			break;
		}

		// --- Lists ---
		case 'ul':
			if (schema.nodes.bullet_list) safeRun(wrapIn(schema.nodes.bullet_list));
			break;

		case 'ol':
			if (schema.nodes.ordered_list) safeRun(wrapIn(schema.nodes.ordered_list));
			break;

		// inside handleAction() switch
		case 'task': {
			const { state } = editorView;
			const { schema, selection } = state;
			const { list_item, bullet_list, paragraph } = schema.nodes;
			if (!list_item || !bullet_list || !paragraph) break;

			const { $from } = selection;
			// If already in a list_item → toggle checked
			const liDepth = (() => {
				for (let d = $from.depth; d > 0; d--) if ($from.node(d).type === list_item) return d;
				return null;
			})();
			if (liDepth != null) {
				const pos = $from.before(liDepth);
				const node = state.doc.nodeAt(pos);
				if (node) {
					const nextChecked = !(node.attrs?.checked ?? false);
					editorView.dispatch(
						state.tr
							.setNodeMarkup(pos, list_item, { ...node.attrs, checked: nextChecked })
							.scrollIntoView()
					);
					break;
				}
			}
			// Else insert a new bullet list with one unchecked task
			const task = list_item.create({ checked: false }, paragraph.create());
			const list = bullet_list.create(null, task);
			editorView.dispatch(state.tr.replaceSelectionWith(list).scrollIntoView());
			break;
		}

		// --- History ---
		case 'undo':
			safeRun(undo);
			break;

		case 'redo':
			safeRun(redo);
			break;

		// --- Import/Export ---
		case 'export':
			console.log(exportMarkdown());
			break;

		case 'import':
			alert('Use importMarkdown(markdown) programmatically.');
			break;

		default:
			console.warn(`⚠️ Action "${action}" not implemented.`);
	}

	editorView.focus();
}

export function getCommandState(
	action: ToolbarAction,
	state: EditorState
): { enabled: boolean; reason?: string } {
	const { schema } = state;

	try {
		switch (action) {
			case 'bold':
				if (!schema.marks.strong) return { enabled: false, reason: 'Bold mark not in schema' };
				return toggleMark(schema.marks.strong)(state)
					? { enabled: true }
					: { enabled: false, reason: 'Cannot apply bold here' };

			case 'italic':
				if (!schema.marks.em) return { enabled: false, reason: 'Italic mark not in schema' };
				return toggleMark(schema.marks.em)(state)
					? { enabled: true }
					: { enabled: false, reason: 'Cannot apply italic here' };

			case 'strike':
				if (!schema.marks.strikethrough)
					return { enabled: false, reason: 'Strikethrough not supported' };
				return toggleMark(schema.marks.strikethrough)(state)
					? { enabled: true }
					: { enabled: false, reason: 'Cannot strike through here' };

			case 'h1':
				return setBlockType(schema.nodes.heading, { level: 1 })(state)
					? { enabled: true }
					: { enabled: false, reason: 'Not inside a text block' };

			case 'h2':
				return setBlockType(schema.nodes.heading, { level: 2 })(state)
					? { enabled: true }
					: { enabled: false, reason: 'Not inside a text block' };

			case 'quote':
				return schema.nodes.blockquote
					? wrapIn(schema.nodes.blockquote)(state)
						? { enabled: true }
						: { enabled: false, reason: 'Cannot create quote here' }
					: { enabled: false, reason: 'Blockquote not supported' };

			case 'ul':
				return schema.nodes.bullet_list
					? wrapIn(schema.nodes.bullet_list)(state)
						? { enabled: true }
						: { enabled: false, reason: 'Cannot start list here' }
					: { enabled: false, reason: 'Lists not supported' };

			case 'ol':
				return schema.nodes.ordered_list
					? wrapIn(schema.nodes.ordered_list)(state)
						? { enabled: true }
						: { enabled: false, reason: 'Cannot start ordered list here' }
					: { enabled: false, reason: 'Lists not supported' };

			case 'codeblock':
				return schema.nodes.code_block
					? setBlockType(schema.nodes.code_block)(state)
						? { enabled: true }
						: { enabled: false, reason: 'Not a valid block context' }
					: { enabled: false, reason: 'Code blocks not supported' };

			case 'undo':
				return undo(state)
					? { enabled: true }
					: { enabled: false, reason: 'No undo steps available' };

			case 'redo':
				return redo(state)
					? { enabled: true }
					: { enabled: false, reason: 'No redo steps available' };

			// Always allowed
			case 'link':
			case 'task':
			case 'export':
			case 'import':
				return { enabled: true };

			default:
				return { enabled: true };
		}
	} catch (err) {
		console.error('getCommandState error', err);
		return { enabled: false, reason: 'Unexpected command error' };
	}
}
