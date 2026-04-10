import { Plugin } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';

function isTaskToggleTarget(target: EventTarget | null): target is HTMLInputElement {
	return (
		target instanceof HTMLInputElement &&
		target.type === 'checkbox' &&
		target.dataset.role === 'task-toggle'
	);
}

function hasCheckedAttr(node: PMNode): boolean {
	return Object.prototype.hasOwnProperty.call(node.attrs, 'checked');
}

function safePosFromClick(view: EditorView, target: HTMLElement, fallbackPos: number): number | null {
	try {
		const domPos = view.posAtDOM(target, 0);
		if (typeof domPos === 'number') {
			return domPos;
		}
	} catch {
		// Fall back to the ProseMirror-provided click position below.
	}

	try {
		if (fallbackPos >= 0 && fallbackPos <= view.state.doc.content.size) {
			return fallbackPos;
		}
	} catch {
		// ignore
	}

	return null;
}

function findTaskListItemAtPos(view: EditorView, pos: number): { node: PMNode; pos: number } | null {
	const { state } = view;
	const listItemType = state.schema.nodes.list_item;
	if (!listItemType) return null;

	const $pos = state.doc.resolve(pos);

	for (let depth = $pos.depth; depth > 0; depth -= 1) {
		const node = $pos.node(depth);

		if (node.type === listItemType && hasCheckedAttr(node) && typeof node.attrs.checked === 'boolean') {
			return {
				node,
				pos: $pos.before(depth)
			};
		}
	}

	return null;
}

export function taskTogglePlugin() {
	return new Plugin({
		props: {
			handleClick(view: EditorView, pos: number, event: MouseEvent) {
				const target = event.target;
				if (!isTaskToggleTarget(target)) return false;

				// Only handle checkboxes that belong to this editor.
				if (!view.dom.contains(target)) return false;

				event.preventDefault();
				event.stopPropagation();

				const resolvedPos = safePosFromClick(view, target, pos);
				if (resolvedPos == null) return false;

				const hit = findTaskListItemAtPos(view, resolvedPos);
				if (!hit) return false;

				const { state, dispatch } = view;
				const { node, pos: itemPos } = hit;

				const nextChecked = !node.attrs.checked;

				const tr = state.tr.setNodeMarkup(
					itemPos,
					node.type,
					{ ...node.attrs, checked: nextChecked },
					node.marks
				);

				// Preserve scroll and avoid browser focus jumps.
				const scrollX = window.scrollX;
				const scrollY = window.scrollY;

				dispatch(tr);

				try {
					(view.dom as HTMLElement).focus?.({ preventScroll: true } as FocusOptions);
				} catch {
					(view.dom as HTMLElement).focus?.();
				}

				queueMicrotask(() => {
					window.scrollTo(scrollX, scrollY);
				});

				return true;
			}
		}
	});
}