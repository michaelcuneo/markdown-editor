import { Plugin, PluginKey } from 'prosemirror-state';
import { liftListItem } from 'prosemirror-schema-list';
import type { Node as PMNode, Schema } from 'prosemirror-model';
import type { ResolvedPos } from 'prosemirror-model';

function findAncestorDepth($pos: ResolvedPos, nodeType: PMNode['type']): number | null {
	for (let depth = $pos.depth; depth > 0; depth -= 1) {
		if ($pos.node(depth).type === nodeType) {
			return depth;
		}
	}
	return null;
}

function isAtStartOfTextblock($pos: ResolvedPos): boolean {
	return $pos.parent.isTextblock && $pos.parentOffset === 0;
}

function isFirstBlockInListItem($pos: ResolvedPos, listItemDepth: number): boolean {
	return $pos.depth === listItemDepth + 1 && $pos.index(listItemDepth) === 0;
}

function isStructurallyEmptyListItem(
	itemNode: PMNode,
	paragraphType: PMNode['type'] | undefined
): boolean {
	if (itemNode.childCount !== 1) return false;

	const firstChild = itemNode.firstChild;
	if (!firstChild || !paragraphType) return false;
	if (firstChild.type !== paragraphType) return false;

	return firstChild.content.size === 0;
}

/**
 * Smart Backspace behavior for Markdown-style lists.
 *
 * Behavior:
 * - Only runs when the selection is empty and the cursor is at the start of a textblock.
 * - Only runs when the cursor is in the first block of a list item.
 * - Empty list item: lift out of the list.
 * - Non-empty list item: also lift out of the list.
 *
 * This intentionally avoids brittle manual delete/reinsert logic and relies on
 * ProseMirror's list commands for structurally safe transforms.
 */
export function markdownBackspacePlugin(schema: Schema) {
	const key = new PluginKey('markdown-backspace');
	const { list_item, paragraph } = schema.nodes;

	return new Plugin({
		key,
		props: {
			handleKeyDown(view, event) {
				if (event.key !== 'Backspace') return false;
				if (!list_item) return false;

				const { state, dispatch } = view;
				const { selection } = state;
				const { $from } = selection;

				if (!selection.empty) return false;
				if (!isAtStartOfTextblock($from)) return false;

				const listItemDepth = findAncestorDepth($from, list_item);
				if (listItemDepth == null) return false;

				// Only act when we're in the first editable block of the list item.
				// This avoids surprising behavior in multi-block list items.
				if (!isFirstBlockInListItem($from, listItemDepth)) return false;

				const itemNode = $from.node(listItemDepth);

				// Keep the behavior simple and structurally safe:
				// both empty and non-empty list items use liftListItem.
				//
				// Empty-item detection is kept here mostly to make the intent obvious,
				// but both branches intentionally use the same safe transform.
				const isEmpty = isStructurallyEmptyListItem(itemNode, paragraph);

				const lifted = liftListItem(list_item)(state, dispatch);
				if (!lifted) return false;

				event.preventDefault();

				// Returning true after a successful lift keeps the key handling consistent.
				if (isEmpty) {
					return true;
				}

				return true;
			}
		}
	});
}