import { Plugin, PluginKey } from 'prosemirror-state';
import { joinForward } from 'prosemirror-commands';
import type { Schema, Node as PMNode, NodeType, ResolvedPos } from 'prosemirror-model';

function findAncestorDepth($pos: ResolvedPos, nodeType: NodeType): number | null {
	for (let depth = $pos.depth; depth > 0; depth -= 1) {
		if ($pos.node(depth).type === nodeType) {
			return depth;
		}
	}
	return null;
}

function isAtEndOfTextblock($pos: ResolvedPos): boolean {
	return $pos.parent.isTextblock && $pos.parentOffset === $pos.parent.content.size;
}

function isLastBlockInListItem($pos: ResolvedPos, listItemDepth: number): boolean {
	if ($pos.depth !== listItemDepth + 1) return false;
	return $pos.index(listItemDepth) === $pos.node(listItemDepth).childCount - 1;
}

function isListNode(node: PMNode, bulletList?: NodeType, orderedList?: NodeType): boolean {
	return (
		(bulletList != null && node.type === bulletList) ||
		(orderedList != null && node.type === orderedList)
	);
}

/**
 * Smart Delete behavior for Markdown-style lists.
 *
 * Behavior:
 * - Only runs when the selection is empty and the cursor is at the end of a textblock.
 * - Only runs when that textblock is the last block in the current list item.
 * - If there is a next sibling list item, it delegates to ProseMirror's forward join behavior.
 * - If this is the last item in the list, it does nothing.
 *
 * This is intentionally conservative and avoids fragile manual join/lift logic.
 */
export function markdownDeletePlugin(schema: Schema) {
	const key = new PluginKey('markdown-delete');
	const { list_item, bullet_list, ordered_list } = schema.nodes;

	return new Plugin({
		key,
		props: {
			handleKeyDown(view, event) {
				if (event.key !== 'Delete') return false;
				if (!list_item) return false;

				const { state, dispatch } = view;
				const { selection } = state;
				const { $from } = selection;

				if (!selection.empty) return false;
				if (!isAtEndOfTextblock($from)) return false;

				const listItemDepth = findAncestorDepth($from, list_item);
				if (listItemDepth == null) return false;

				// Only act from the last block in the current list item to avoid
				// surprising behavior in multi-block list items.
				if (!isLastBlockInListItem($from, listItemDepth)) return false;

				const listDepth = listItemDepth - 1;
				if (listDepth < 1) return false;

				const parentList = $from.node(listDepth);
				if (!isListNode(parentList, bullet_list, ordered_list)) return false;

				const itemIndex = $from.index(listDepth);
				const hasNextSiblingItem = itemIndex < parentList.childCount - 1;
				if (!hasNextSiblingItem) return false;

				const handled = joinForward(state, dispatch);
				if (!handled) return false;

				event.preventDefault();
				return true;
			}
		}
	});
}