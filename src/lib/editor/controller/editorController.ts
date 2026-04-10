import type { EditorView } from 'prosemirror-view';
import type { EditorState, Command } from 'prosemirror-state';
import type { ToolbarAction } from '../../types/index.js';

import { undo, redo } from 'prosemirror-history';
import { toggleMark, setBlockType, wrapIn } from 'prosemirror-commands';
import { wrapInList } from 'prosemirror-schema-list';
import { defaultMarkdownSerializer, defaultMarkdownParser } from 'prosemirror-markdown';

let editorView: EditorView | null = null;

export function setEditorView(view: EditorView | null): void {
	editorView = view;
}

export function getEditorView(): EditorView | null {
	return editorView;
}

function withView<T>(fn: (view: EditorView) => T): T | null {
	if (!editorView) return null;
	return fn(editorView);
}

function runCommand(view: EditorView, command: Command): boolean {
	const executed = command(view.state, view.dispatch, view);
	if (!executed) {
		console.warn('[ProseMirror] Command not executed');
	}
	return executed;
}

function canRun(command: Command, state: EditorState): boolean {
	return command(state);
}

export function exportMarkdown(): string | null {
	return withView((view) => defaultMarkdownSerializer.serialize(view.state.doc));
}

export function importMarkdown(markdown: string): void {
	withView((view) => {
		try {
			const { state } = view;
			const doc = defaultMarkdownParser.parse(markdown);

			const from = 0;
			const to = state.doc.content.size;

			const tr = state.tr.replaceWith(from, to, doc.content).scrollIntoView();
			view.dispatch(tr);
		} catch (err) {
			console.error('[ProseMirror] Failed to import markdown', err);
		}
	});
}

function toggleCodeBlock(view: EditorView): boolean {
	const { state } = view;
	const { code_block, paragraph } = state.schema.nodes;

	if (!code_block || !paragraph) return false;

	const isCodeBlock = state.selection.$from.parent.type === code_block;
	const command = isCodeBlock ? setBlockType(paragraph) : setBlockType(code_block);

	return runCommand(view, command);
}

function canToggleCodeBlock(state: EditorState): { enabled: boolean; active: boolean } {
	const { code_block, paragraph } = state.schema.nodes;

	if (!code_block || !paragraph) {
		return { enabled: false, active: false };
	}

	const isActive = state.selection.$from.parent.type === code_block;
	const command = isActive ? setBlockType(paragraph) : setBlockType(code_block);

	return {
		enabled: canRun(command, state),
		active: isActive
	};
}

function toggleTaskItem(view: EditorView): boolean {
	const { state } = view;
	const { schema, selection } = state;
	const { list_item, bullet_list, paragraph } = schema.nodes;

	if (!list_item || !bullet_list || !paragraph) return false;

	const { $from } = selection;

	for (let depth = $from.depth; depth > 0; depth--) {
		if ($from.node(depth).type === list_item) {
			const pos = $from.before(depth);
			const node = state.doc.nodeAt(pos);

			if (!node) return false;

			const currentChecked =
				typeof node.attrs?.checked === 'boolean' ? node.attrs.checked : false;

			view.dispatch(
				state.tr
					.setNodeMarkup(pos, list_item, { ...node.attrs, checked: !currentChecked })
					.scrollIntoView()
			);

			return true;
		}
	}

	try {
		const task = list_item.createAndFill({ checked: false });
		if (!task) return false;

		const list = bullet_list.createAndFill(null, [task]);
		if (!list) return false;

		view.dispatch(state.tr.replaceSelectionWith(list).scrollIntoView());
		return true;
	} catch (err) {
		console.error('[ProseMirror] Failed to toggle task item', err);
		return false;
	}
}

export function handleAction(action: ToolbarAction): void {
	withView((view) => {
		const { state } = view;
		const { schema } = state;

		switch (action) {
			case 'bold':
				if (schema.marks.strong) {
					runCommand(view, toggleMark(schema.marks.strong));
				}
				break;

			case 'italic':
				if (schema.marks.em) {
					runCommand(view, toggleMark(schema.marks.em));
				}
				break;

			case 'strike':
				if (schema.marks.strikethrough) {
					runCommand(view, toggleMark(schema.marks.strikethrough));
				}
				break;

			case 'link': {
				const linkMark = schema.marks.link;
				if (!linkMark) break;

				let url = prompt('Enter URL:');
				if (!url) break;

				url = url.trim();
				if (!url) break;

				if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) {
					url = 'https://' + url;
				}

				runCommand(view, toggleMark(linkMark, { href: url }));
				break;
			}

			case 'h1':
				if (schema.nodes.heading) {
					runCommand(view, setBlockType(schema.nodes.heading, { level: 1 }));
				}
				break;

			case 'h2':
				if (schema.nodes.heading) {
					runCommand(view, setBlockType(schema.nodes.heading, { level: 2 }));
				}
				break;

			case 'quote':
				if (schema.nodes.blockquote) {
					runCommand(view, wrapIn(schema.nodes.blockquote));
				}
				break;

			case 'codeblock':
				toggleCodeBlock(view);
				break;

			case 'hr': {
				const hr = schema.nodes.horizontal_rule;
				if (!hr) break;

				const node = hr.create();
				view.dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
				break;
			}

			case 'ul':
				if (schema.nodes.bullet_list) {
					runCommand(view, wrapInList(schema.nodes.bullet_list));
				}
				break;

			case 'ol':
				if (schema.nodes.ordered_list) {
					runCommand(view, wrapInList(schema.nodes.ordered_list));
				}
				break;

			case 'task':
				toggleTaskItem(view);
				break;

			case 'undo':
				runCommand(view, undo);
				break;

			case 'redo':
				runCommand(view, redo);
				break;

			case 'export':
				console.log(exportMarkdown());
				break;

			case 'import':
				alert('Use importMarkdown(markdown) programmatically.');
				break;

			default:
				console.warn(`[ProseMirror] Action "${action}" not implemented.`);
				break;
		}

		view.focus();
	});
}

export function getCommandState(
	action: ToolbarAction,
	state: EditorState
): { enabled: boolean; reason?: string } {
	const { schema } = state;

	try {
		switch (action) {
			case 'bold':
				if (!schema.marks.strong) {
					return { enabled: false, reason: 'Bold mark not in schema' };
				}
				return canRun(toggleMark(schema.marks.strong), state)
					? { enabled: true }
					: { enabled: false, reason: 'Cannot apply bold here' };

			case 'italic':
				if (!schema.marks.em) {
					return { enabled: false, reason: 'Italic mark not in schema' };
				}
				return canRun(toggleMark(schema.marks.em), state)
					? { enabled: true }
					: { enabled: false, reason: 'Cannot apply italic here' };

			case 'strike':
				if (!schema.marks.strikethrough) {
					return { enabled: false, reason: 'Strikethrough not supported' };
				}
				return canRun(toggleMark(schema.marks.strikethrough), state)
					? { enabled: true }
					: { enabled: false, reason: 'Cannot strike through here' };

			case 'link':
				return schema.marks.link
					? { enabled: true }
					: { enabled: false, reason: 'Links not supported' };

			case 'h1': {
				const heading = schema.nodes.heading;
				if (!heading) {
					return { enabled: false, reason: 'Heading not supported' };
				}
				return canRun(setBlockType(heading, { level: 1 }), state)
					? { enabled: true }
					: { enabled: false, reason: 'Cannot turn this into a heading' };
			}

			case 'h2': {
				const heading = schema.nodes.heading;
				if (!heading) {
					return { enabled: false, reason: 'Heading not supported' };
				}
				return canRun(setBlockType(heading, { level: 2 }), state)
					? { enabled: true }
					: { enabled: false, reason: 'Cannot turn this into a heading' };
			}

			case 'quote':
				if (!schema.nodes.blockquote) {
					return { enabled: false, reason: 'Blockquote not supported' };
				}
				return canRun(wrapIn(schema.nodes.blockquote), state)
					? { enabled: true }
					: { enabled: false, reason: 'Cannot create quote here' };

			case 'ul':
				if (!schema.nodes.bullet_list) {
					return { enabled: false, reason: 'Bullet lists not supported' };
				}
				return canRun(wrapInList(schema.nodes.bullet_list), state)
					? { enabled: true }
					: { enabled: false, reason: 'Cannot start bullet list here' };

			case 'ol':
				if (!schema.nodes.ordered_list) {
					return { enabled: false, reason: 'Ordered lists not supported' };
				}
				return canRun(wrapInList(schema.nodes.ordered_list), state)
					? { enabled: true }
					: { enabled: false, reason: 'Cannot start ordered list here' };

			case 'codeblock': {
				const result = canToggleCodeBlock(state);
				return result.enabled
					? { enabled: true, reason: result.active ? 'active' : undefined }
					: { enabled: false, reason: 'Cannot toggle code block here' };
			}

			case 'task': {
				const { list_item, bullet_list, paragraph } = schema.nodes;
				if (!list_item || !bullet_list || !paragraph) {
					return { enabled: false, reason: 'Task lists not supported' };
				}
				return { enabled: true };
			}

			case 'hr':
				return schema.nodes.horizontal_rule
					? { enabled: true }
					: { enabled: false, reason: 'Horizontal rule not supported' };

			case 'undo':
				return undo(state)
					? { enabled: true }
					: { enabled: false, reason: 'No undo steps available' };

			case 'redo':
				return redo(state)
					? { enabled: true }
					: { enabled: false, reason: 'No redo steps available' };

			case 'export':
			case 'import':
				return { enabled: true };

			default:
				return { enabled: false, reason: 'Unknown action' };
		}
	} catch (err) {
		console.error('[ProseMirror] getCommandState error', err);
		return { enabled: false, reason: 'Unexpected command error' };
	}
}